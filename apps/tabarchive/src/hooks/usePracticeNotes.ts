import { useCallback, useEffect, useRef, useState } from 'react'
import { useBlocker } from '@tanstack/react-router'
import { z } from 'zod'
import type { ArchivedTab } from '../lib/archive'
import { ApiError, api, message, patch } from '../lib/client'
import { readStored, removeStored, writeStored } from '../lib/browser-storage'

const draftSchema = z.object({
  text: z.string().max(10000),
  base: z.string().max(10000),
  owner: z.string().optional(),
})

// Drafts are written on input, before the debounce or any navigation can run.
export function usePracticeNotes(
  tab: ArchivedTab,
  onUpdated: (tab: ArchivedTab) => void,
) {
  const key = `tabarchive:notes-draft:${tab.id}`
  const [text, setText] = useState(tab.notes)
  const [saved, setSaved] = useState(tab.notes)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [conflict, setConflict] = useState(false)
  const [protectedDraft, setProtectedDraft] = useState(true)
  const latest = useRef(tab.notes)
  const base = useRef(tab.notes)
  const inFlight = useRef(false)
  const active = useRef(false)
  const owner = useRef('')
  const updated = useRef(onUpdated)
  updated.current = onUpdated

  useEffect(() => {
    active.current = true
    owner.current = crypto.randomUUID()
    const draft = readStored(key, draftSchema)
    if (draft && draft.text !== tab.notes) {
      latest.current = draft.text
      base.current = draft.base
      setText(draft.text)
      setConflict(draft.base !== tab.notes)
      setProtectedDraft(writeStored(key, { ...draft, owner: owner.current }))
    } else if (draft) removeStored(key)
    setLoaded(true)
    return () => {
      active.current = false
    }
  }, [key])

  const change = (value: string) => {
    latest.current = value
    setText(value)
    setError('')
    setProtectedDraft(
      writeStored(key, {
        text: value,
        base: base.current,
        owner: owner.current,
      }),
    )
  }

  const save = useCallback(async () => {
    if (inFlight.current || latest.current === base.current) return
    const submitted = latest.current
    inFlight.current = true
    setSaving(true)
    setError('')
    try {
      const result = await patch<ArchivedTab>(`/api/tabs/${tab.id}`, {
        notes: submitted,
        notesBase: base.current,
      })
      // Do not erase text entered while this request was in flight.
      const draft = readStored(key, draftSchema)
      if (draft?.owner === owner.current) {
        if (draft.text === submitted) removeStored(key)
        else if (draft.base === base.current)
          writeStored(key, { ...draft, base: submitted })
      }
      base.current = submitted
      if (active.current) {
        setSaved(submitted)
        setConflict(false)
        updated.current(result)
      }
    } catch (err) {
      if (active.current) {
        setError(message(err))
        if (err instanceof ApiError && err.status === 409) setConflict(true)
      }
    } finally {
      inFlight.current = false
      if (active.current) setSaving(false)
    }
  }, [key, tab.id])

  useEffect(() => {
    if (!loaded || saving || conflict || error || text === saved) return
    const timer = setTimeout(() => void save(), 800)
    return () => clearTimeout(timer)
  }, [loaded, text, saved, saving, conflict, error, save])

  useBlocker({
    shouldBlockFn: () =>
      text !== saved &&
      !protectedDraft &&
      !window.confirm(
        'Your notes have not been saved. Leave and discard them?',
      ),
    enableBeforeUnload: text !== saved && !protectedDraft,
  })

  async function loadSaved() {
    try {
      const current = await api<ArchivedTab>(`/api/tabs/${tab.id}`)
      base.current = current.notes
      latest.current = current.notes
      setText(current.notes)
      setSaved(current.notes)
      setConflict(false)
      setError('')
      removeStored(key)
      updated.current(current)
    } catch (err) {
      setError(message(err))
    }
  }

  return {
    text,
    change,
    save,
    saving,
    error,
    conflict,
    loadSaved,
    dirty: text !== saved,
    status:
      !protectedDraft && text !== saved
        ? 'Draft could not be kept in this browser. Save before leaving.'
        : conflict
          ? 'Saved notes changed elsewhere. Your draft is kept here; copy it before loading the saved notes.'
          : error
            ? 'Could not save. Your draft is kept in this browser.'
            : saving
              ? 'Saving notes…'
              : text !== saved
                ? 'Draft kept in this browser…'
                : 'Notes saved.',
  }
}
