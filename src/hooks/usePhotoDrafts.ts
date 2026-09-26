import { useCallback, useEffect, useRef, useState } from 'react'
import type { PhotoSlot } from '../db/saveShopForm'
import { MAX_PHOTOS_PER_SHOP, type PhotoInput } from '../db/types'
import { ImageProcessError, processImageFile } from '../lib/image'

export type PhotoDraft =
  | { key: string; state: 'processing' }
  | { key: string; state: 'ready'; photo: PhotoInput }
  | { key: string; state: 'error'; message: string }
  /** Already in the DB (edit screen). Shown with its small image; removed / moved only on screen until saved. */
  | { key: string; state: 'saved'; photoId: string; small: Blob }

/** A saved photo to start the edit screen with. */
export interface SavedPhoto {
  id: string
  small: Blob
}

export const PHOTO_LIMIT_MESSAGE = `写真は${MAX_PHOTOS_PER_SHOP}枚までです`

let keySeq = 0
const nextKey = () => `draft-${++keySeq}`

/**
 * Photos picked on the register screen. Files are processed ONE AT A TIME (never several
 * decodes at once, to save iPhone memory). Failed photos keep their slot with a message but
 * do not count toward the limit and are not saved.
 * `initial` (edit screen): the shop's saved photos in order; read only on the first render.
 */
export function usePhotoDrafts(initial: readonly SavedPhoto[] = []) {
  const [drafts, setDrafts] = useState<PhotoDraft[]>(() =>
    initial.map((p) => ({ key: `saved-${p.id}`, state: 'saved', photoId: p.id, small: p.small })),
  )
  const [notice, setNotice] = useState<string>()
  const queue = useRef<{ key: string; file: File }[]>([])
  const running = useRef(false)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      queue.current = []
    }
  }, [])

  const pump = useCallback(async () => {
    if (running.current) return
    running.current = true
    try {
      while (alive.current && queue.current.length > 0) {
        const { key, file } = queue.current.shift()!
        let next: PhotoDraft
        try {
          const photo = await processImageFile(file)
          next = { key, state: 'ready', photo }
        } catch (e) {
          const message = e instanceof ImageProcessError ? e.userMessage : 'この写真は読み込めませんでした'
          next = { key, state: 'error', message }
        }
        if (!alive.current) break
        setDrafts((ds) => ds.map((d) => (d.key === key ? next : d)))
      }
    } finally {
      running.current = false
    }
  }, [])

  /** Accept up to the remaining slots; the rest are refused with a notice. */
  const addFiles = useCallback(
    (files: File[]) => {
      const counted = drafts.filter((d) => d.state !== 'error').length
      const room = Math.max(0, MAX_PHOTOS_PER_SHOP - counted)
      const accepted = files.slice(0, room)
      setNotice(files.length > room ? PHOTO_LIMIT_MESSAGE : undefined)
      if (accepted.length === 0) return
      const items = accepted.map((file) => ({ key: nextKey(), file }))
      setDrafts((ds) => [...ds, ...items.map(({ key }) => ({ key, state: 'processing' as const }))])
      queue.current.push(...items)
      void pump()
    },
    [drafts, pump],
  )

  const remove = useCallback((key: string) => {
    queue.current = queue.current.filter((q) => q.key !== key)
    setDrafts((ds) => ds.filter((d) => d.key !== key))
    setNotice(undefined)
  }, [])

  const showLimitNotice = useCallback(() => setNotice(PHOTO_LIMIT_MESSAGE), [])

  /** Swap with the left (-1) or right (+1) neighbour. The first photo to be saved is the cover. */
  const move = useCallback((key: string, delta: -1 | 1) => {
    setDrafts((ds) => {
      const i = ds.findIndex((d) => d.key === key)
      const j = i + delta
      if (i < 0 || j < 0 || j >= ds.length) return ds
      const next = [...ds]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }, [])

  const readyPhotos = drafts.flatMap((d) => (d.state === 'ready' ? [d.photo] : []))
  /** Final order to save: saved photos by id, new ones with their images (failed / processing ones are left out). */
  const slots: PhotoSlot[] = drafts.flatMap((d): PhotoSlot[] =>
    d.state === 'saved' ? [{ photoId: d.photoId }] : d.state === 'ready' ? [{ photo: d.photo }] : [],
  )
  const isProcessing = drafts.some((d) => d.state === 'processing')
  const isFull = drafts.filter((d) => d.state !== 'error').length >= MAX_PHOTOS_PER_SHOP

  return { drafts, notice, addFiles, remove, move, showLimitNotice, readyPhotos, slots, isProcessing, isFull }
}
