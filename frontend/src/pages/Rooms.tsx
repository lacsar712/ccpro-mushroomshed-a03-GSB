import { createSignal, onMount } from 'solid-js'
import { For, Show } from 'solid-js'
import { api } from '../api/client'
import type { Room, RoomStatus, Shed } from '../types'

function toLocalInput(iso?: string) {
  const d = iso ? new Date(iso) : new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const statuses: RoomStatus[] = ['fruiting', 'idle', 'sanitize']

const empty = {
  shedId: '',
  roomCode: '',
  species: '',
  capacityBags: '',
  status: 'fruiting' as RoomStatus,
}

export default function Rooms() {
  const [rows, setRows] = createSignal<Room[]>([])
  const [sheds, setSheds] = createSignal<Shed[]>([])
  const [form, setForm] = createSignal({ ...empty })
  const [error, setError] = createSignal('')

  // 正在解除消毒的室 ID + ReleaseNote 表单
  const [releasingId, setReleasingId] = createSignal<number | null>(null)
  const [releaseForm, setReleaseForm] = createSignal({
    reason: '',
    releasedAt: toLocalInput(),
  })
  const [releaseError, setReleaseError] = createSignal('')

  async function load() {
    const [rooms, shedList] = await Promise.all([
      api<Room[]>('/api/rooms'),
      api<Shed[]>('/api/sheds'),
    ])
    setRows(rooms)
    setSheds(shedList)
  }

  onMount(() => {
    load().catch((e) => setError(e.message))
  })

  async function onSubmit(e: Event) {
    e.preventDefault()
    setError('')
    try {
      await api('/api/rooms', {
        method: 'POST',
        body: JSON.stringify({
          shedId: Number(form().shedId),
          roomCode: form().roomCode,
          species: form().species,
          capacityBags: Number(form().capacityBags),
          status: form().status,
        }),
      })
      setForm({ ...empty })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    }
  }

  async function remove(id: number) {
    if (!confirm('确认删除该出菇室？')) return
    try {
      await api(`/api/rooms/${id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
  }

  function openRelease(roomId: number) {
    setReleaseError('')
    setReleaseForm({ reason: '', releasedAt: toLocalInput() })
    setReleasingId(roomId)
  }

  async function submitRelease(roomId: number) {
    setReleaseError('')
    try {
      // 解除记录在后端落库后，室态由后端改回 fruiting（禁止只改前端状态）
      await api('/api/release-notes', {
        method: 'POST',
        body: JSON.stringify({
          roomId,
          reason: releaseForm().reason,
          releasedAt: new Date(releaseForm().releasedAt).toISOString(),
        }),
      })
      setReleasingId(null)
      await load()
    } catch (err) {
      setReleaseError(err instanceof Error ? err.message : '解除消毒失败')
    }
  }

  function statusBadge(status: RoomStatus) {
    return `badge ${status}`
  }

  return (
    <div>
      <header class="page-header">
        <h1>出菇室</h1>
        <p class="muted">菌种、袋数容量与房态；sanitize 室须登记消毒解除（ReleaseNote）才能回到 fruiting</p>
      </header>
      {error() && <div class="error">{error()}</div>}

      <form class="panel form-grid" onSubmit={onSubmit}>
        <label>
          所属菇房
          <select
            value={form().shedId}
            onChange={(e) => setForm({ ...form(), shedId: e.currentTarget.value })}
            required
          >
            <option value="">选择菇房</option>
            <For each={sheds()}>
              {(s) => <option value={String(s.id)}>{s.name}</option>}
            </For>
          </select>
        </label>
        <label>
          室编号
          <input
            value={form().roomCode}
            onInput={(e) => setForm({ ...form(), roomCode: e.currentTarget.value })}
            required
          />
        </label>
        <label>
          品种
          <input
            value={form().species}
            onInput={(e) => setForm({ ...form(), species: e.currentTarget.value })}
            required
          />
        </label>
        <label>
          容量 (袋)
          <input
            type="number"
            min="1"
            value={form().capacityBags}
            onInput={(e) => setForm({ ...form(), capacityBags: e.currentTarget.value })}
            required
          />
        </label>
        <label>
          状态
          <select
            value={form().status}
            onChange={(e) =>
              setForm({ ...form(), status: e.currentTarget.value as RoomStatus })
            }
          >
            <For each={statuses}>{(s) => <option value={s}>{s}</option>}</For>
          </select>
        </label>
        <button type="submit" class="btn primary">
          新增出菇室
        </button>
      </form>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>菇房 ID</th>
              <th>编号</th>
              <th>品种</th>
              <th>容量</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <For each={rows()}>
              {(r) => (
                <>
                  <tr>
                    <td>{r.id}</td>
                    <td>{r.shedId}</td>
                    <td>{r.roomCode}</td>
                    <td>{r.species}</td>
                    <td>{r.capacityBags}</td>
                    <td>
                      <span class={statusBadge(r.status)}>{r.status}</span>
                    </td>
                    <td>
                      <Show when={r.status === 'sanitize'}>
                        <button
                          type="button"
                          class="btn ghost"
                          onClick={() => openRelease(r.id)}
                        >
                          解除消毒
                        </button>
                      </Show>
                      <button type="button" class="btn ghost" onClick={() => remove(r.id)}>
                        删除
                      </button>
                    </td>
                  </tr>
                  <Show when={releasingId() === r.id}>
                    <tr>
                      <td colSpan={7}>
                        <div class="check-editor panel">
                          <Show when={releaseError()}>
                            <div class="error">{releaseError()}</div>
                          </Show>
                          <label>
                            解除时间
                            <input
                              type="datetime-local"
                              value={releaseForm().releasedAt}
                              onInput={(e) =>
                                setReleaseForm({
                                  ...releaseForm(),
                                  releasedAt: e.currentTarget.value,
                                })
                              }
                            />
                          </label>
                          <label>
                            消毒 / 解除原因
                            <input
                              placeholder="如：熏蒸完成、复检无菌"
                              value={releaseForm().reason}
                              onInput={(e) =>
                                setReleaseForm({ ...releaseForm(), reason: e.currentTarget.value })
                              }
                            />
                          </label>
                          <div class="check-actions">
                            <button
                              type="button"
                              class="btn primary"
                              onClick={() => submitRelease(r.id)}
                            >
                              确认解除并回到 fruiting
                            </button>
                            <button
                              type="button"
                              class="btn ghost"
                              onClick={() => setReleasingId(null)}
                            >
                              取消
                            </button>
                            <span class="hint">无 ReleaseNote 时直接改回 fruiting，后端返回 409</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </Show>
                </>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </div>
  )
}
