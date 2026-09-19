import { createSignal, onMount } from 'solid-js'
import { For } from 'solid-js'
import { api } from '../api/client'
import type { ReleaseNote, Room, RoomStatus, Shed } from '../types'

const statuses: RoomStatus[] = ['fruiting', 'idle', 'sanitize']

const empty = {
  shedId: '',
  roomCode: '',
  species: '',
  capacityBags: '',
  status: 'fruiting' as RoomStatus,
}

function StatusChanger(props: {
  room: Room
  onChanged: () => Promise<void>
  onError: (msg: string) => void
}) {
  const [target, setTarget] = createSignal<RoomStatus>(props.room.status)

  async function apply() {
    const t = target()
    if (t === props.room.status) return
    let reason: string | undefined
    if (props.room.status === 'sanitize' && t !== 'sanitize') {
      const input = prompt('出菇室离开 sanitize 须登记 ReleaseNote，请输入解除原因')
      if (!input) {
        props.onError('已取消：离开 sanitize 必须提供 ReleaseNote 原因')
        return
      }
      reason = input
    }
    try {
      await api(`/api/rooms/${props.room.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(reason ? { status: t, reason } : { status: t }),
      })
      await props.onChanged()
    } catch (err) {
      props.onError(err instanceof Error ? err.message : '状态更新失败')
    }
  }

  return (
    <span class="status-changer">
      <select
        value={target()}
        onChange={(e) => setTarget(e.currentTarget.value as RoomStatus)}
      >
        <For each={statuses}>{(s) => <option value={s}>{s}</option>}</For>
      </select>
      <button type="button" class="btn ghost" onClick={apply}>
        改态
      </button>
    </span>
  )
}

export default function Rooms() {
  const [rows, setRows] = createSignal<Room[]>([])
  const [sheds, setSheds] = createSignal<Shed[]>([])
  const [releases, setReleases] = createSignal<ReleaseNote[]>([])
  const [form, setForm] = createSignal({ ...empty })
  const [error, setError] = createSignal('')

  async function load() {
    const [rooms, shedList, releaseList] = await Promise.all([
      api<Room[]>('/api/rooms'),
      api<Shed[]>('/api/sheds'),
      api<ReleaseNote[]>('/api/release-notes'),
    ])
    setRows(rooms)
    setSheds(shedList)
    setReleases(releaseList)
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

  function statusBadge(status: RoomStatus) {
    return `badge ${status}`
  }

  return (
    <div>
      <header class="page-header">
        <h1>出菇室</h1>
        <p class="muted">菌种、袋数容量与房态</p>
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
              <th>改态</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <For each={rows()}>
              {(r) => (
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
                    <StatusChanger room={r} onChanged={load} onError={setError} />
                  </td>
                  <td>
                    <button type="button" class="btn ghost" onClick={() => remove(r.id)}>
                      删除
                    </button>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>

      <header class="page-header">
        <h1>消杀解除记录</h1>
        <p class="muted">出菇室离开 sanitize 须登记 ReleaseNote</p>
      </header>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>室 ID</th>
              <th>解除原因</th>
              <th>解除时间</th>
            </tr>
          </thead>
          <tbody>
            <For each={releases()}>
              {(n) => (
                <tr>
                  <td>{n.id}</td>
                  <td>{n.roomId}</td>
                  <td>{n.reason}</td>
                  <td>{new Date(n.releasedAt).toLocaleString()}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </div>
  )
}
