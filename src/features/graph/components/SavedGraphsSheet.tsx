import { useCallback, useEffect, useState } from 'react'
import { Share2, Trash2 } from 'lucide-react'
import { Sheet, SheetHeader, SheetTitle, SheetBody, SheetClose } from '../../../shared/components/ui/sheet'
import { Button } from '../../../shared/components/ui/button'
import { Input } from '../../../shared/components/ui/input'
import { ConfirmDialog } from '../../../shared/components/ui/dialog'
import { useToast } from '../../../shared/components/ToastContainer'
import { useT, t } from '../../../shared/i18n'
import { api, ApiError } from '../../../shared/api'
import type { GraphPayload, SavedGraphSummary } from '../../../../shared/contracts/graph'

interface Props {
  open: boolean
  onClose: () => void
  language: 'uz' | 'ru'
  savedId: string | null
  savedTitle: string | null
  getPayload: () => GraphPayload
  onSaved: (id: string, title: string) => void
  onLoaded: (payload: GraphPayload, id: string, title: string) => void
  onDeleted: (id: string) => void
}

export default function SavedGraphsSheet({
  open, onClose, language, savedId, savedTitle, getPayload, onSaved, onLoaded, onDeleted,
}: Props) {
  const tt = useT(language)
  const { success, error: toastError } = useToast()
  const [title, setTitle] = useState('')
  const [graphs, setGraphs] = useState<SavedGraphSummary[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<SavedGraphSummary | null>(null)

  useEffect(() => {
    if (!open) return
    setTitle(savedTitle ?? '')
    setLoadingList(true)
    api.listGraphs()
      .then((res) => setGraphs(res.graphs))
      .catch(() => toastError(t(language, 'graphOpenError')))
      .finally(() => setLoadingList(false))
  }, [open, savedTitle, language, toastError])

  const reload = useCallback(async () => {
    try {
      const res = await api.listGraphs()
      setGraphs(res.graphs)
    } catch { /* ro'yxat eski holicha qoladi */ }
  }, [])

  const handleSave = async (): Promise<void> => {
    const name = title.trim()
    if (!name || busy) return
    setBusy(true)
    try {
      const payload = getPayload()
      if (savedId) {
        await api.updateGraph(savedId, { title: name, payload })
        onSaved(savedId, name)
      } else {
        const res = await api.createGraph({ title: name, payload })
        onSaved(res.graph.id, res.graph.title)
      }
      success(tt('graphSaved'))
      await reload()
    } catch (err) {
      if (err instanceof ApiError && err.code === 'GRAPH_LIMIT_REACHED') {
        toastError(tt('graphLimitReached'))
      } else if (err instanceof ApiError && err.status <= 0) {
        toastError(tt('graphSaveOffline'))
      } else {
        toastError(tt('graphOpenError'))
      }
    } finally {
      setBusy(false)
    }
  }

  const handleOpen = async (item: SavedGraphSummary): Promise<void> => {
    try {
      const res = await api.getGraph(item.id)
      onLoaded(res.graph.payload, res.graph.id, res.graph.title)
      onClose()
    } catch {
      toastError(tt('graphOpenError'))
    }
  }

  const handleShare = async (item: SavedGraphSummary): Promise<void> => {
    try {
      const res = await api.shareGraph(item.id)
      const url = `${window.location.origin}${window.location.pathname}#/grafik?g=${encodeURIComponent(res.shareCode)}`
      try {
        await navigator.clipboard?.writeText(url)
        success(tt('graphShareCopied'))
      } catch {
        success(url)
      }
    } catch {
      toastError(tt('graphOpenError'))
    }
  }

  const handleDelete = async (): Promise<void> => {
    if (!confirmDelete) return
    const id = confirmDelete.id
    setConfirmDelete(null)
    try {
      await api.deleteGraph(id)
      setGraphs((prev) => prev.filter((g) => g.id !== id))
      onDeleted(id)
    } catch {
      toastError(tt('graphOpenError'))
    }
  }

  if (!open) return null

  return (
    <>
      <Sheet open={open} onClose={onClose}>
        <SheetHeader>
          <SheetTitle>{tt('graphSavedGraphs')}</SheetTitle>
        </SheetHeader>
        <SheetClose onClose={onClose} label={tt('graphClose')} />
        <SheetBody className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={tt('graphSaveName')}
              aria-label={tt('graphSaveName')}
              maxLength={60}
            />
            <Button onClick={handleSave} loading={busy} disabled={!title.trim()}>
              {tt('graphSave')}
            </Button>
          </div>

          {loadingList ? (
            <p className="py-4 text-center text-[12px] text-psubtle">{tt('loadingDots')}</p>
          ) : graphs.length === 0 ? (
            <p className="py-4 text-center text-[12px] text-psubtle">{tt('graphNoSaved')}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {graphs.map((g) => (
                <div key={g.id} className="flex items-center gap-2 rounded-2xl bg-psurface p-3">
                  <button
                    type="button"
                    onClick={() => handleOpen(g)}
                    className="min-w-0 flex-1 text-left focus-visible:outline-none"
                  >
                    <p className="truncate text-[13.5px] font-semibold text-pfg">{g.title}</p>
                    <p className="mt-0.5 truncate font-mono text-[11.5px] text-pmuted">{g.exprPreview}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShare(g)}
                    aria-label={tt('graphShare')}
                    className="grid size-9 flex-shrink-0 place-items-center rounded-xl text-pmuted transition-colors hover:bg-pcard hover:text-pfg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
                  >
                    <Share2 size={16} strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(g)}
                    aria-label={tt('graphDelete')}
                    className="grid size-9 flex-shrink-0 place-items-center rounded-xl text-pmuted transition-colors hover:bg-pcard hover:text-pdanger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pprimary"
                  >
                    <Trash2 size={16} strokeWidth={1.75} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </SheetBody>
      </Sheet>

      <ConfirmDialog
        open={confirmDelete !== null}
        title={tt('graphDeleteConfirm')}
        confirmLabel={tt('graphDelete')}
        cancelLabel={tt('graphCancel')}
        destructive
        onConfirm={handleDelete}
        onClose={() => setConfirmDelete(null)}
      />
    </>
  )
}
