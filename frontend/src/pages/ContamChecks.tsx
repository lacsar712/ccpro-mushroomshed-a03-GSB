import { createMemo, createSignal, onMount } from 'solid-js'
import { For } from 'solid-js'
import { api } from '../api/client'
import type { ClimateLog, ContamCheck, ContamResult, Room } from '../types'

function toLocalInput(iso?: string) {
  const d = iso ? new Date(iso) : new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const results: ContamResult[] = ['clear', 'suspect', 'positive']

const empty = {
  climateLogId: '',
  result: 'clear' as ContamResult,
  checkedAt: toLocalInput(),
  message: '',
}

export default function ContamChecks() {
  const [rows, setRows] = createSignal<ContamCheck[]>([])
  const [logs, setLogs] = createSignal<ClimateLog[]>([])
  const [rooms, setRooms] = createSignal<Room[]>([])
  const [form, setForm] = createSignal({ ...empty })
  const [error, setError] = createSignal('')

  const roomById = createMemo(() => new Map(rooms().map((r) => [r.id, r])))
  const logById = createMemo(() => new Map(logs().map((l) => [l.id, l])))
  const checkedLogIds = createMemo(() => new Set(rows().map((c) => c.climateLogId)))
  const uncheckedLogs = createMemo(() => logs().filter((l) => !checkedLogIds().has(l.id)))

  function logLabel(l: ClimateLog) {
    const room = roomById().get(l.roomId)
    const code = room ? room.roomCode : `室 ${l.roomId}`
    return `#${l.id} · ${code} · ${new Date(l.recordedAt).toLocaleString()}`
  }

  async function load() {
    const [checks, logList, roomList] = await Promise.all([
      api<ContamCheck[]>('/api/contam-checks'),
      api<ClimateLog[]>('/api/climate-logs'),
      api<Room[]>('/api/rooms'),
    ])
    setRows(checks)
    setLogs(logList)
    setRooms(roomList)
  }

  onMount(() => {
    load().catch((e) => setError(e.message))
  })

  async function onSubmit(e: Event) {
    e.preventDefault()
    setError('')
    try {
      await api('/api/contam-checks', {
        method: 'POST',
        body: JSON.stringify({
          climateLogId: Number(form().climateLogId),
          result: form().result,
          checkedAt: new Date(form().checkedAt).toISOString(),
          message: form().message || null,
        }),
      })
      setForm({ ...empty, checkedAt: toLocalInput() })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    }
  }

  return (
    <div>
      <header class="page-header">
        <h1>杂菌快检</h1>
        <p class="muted">每条环境记录最多一条快检；positive 将所属出菇室转入 sanitize</p>
      </header>
      {error() && <div class="error">{error()}</div>}

      <form class="panel form-grid" onSubmit={onSubmit}>
        <label class="span-2">
          环境记录
          <select
            value={form().climateLogId}
            onChange={(e) => setForm({ ...form(), climateLogId: e.currentTarget.value })}
            required
          >
            <option value="">选择未快检的环境记录</option>
            <For each={uncheckedLogs()}>{(l) => <option value={String(l.id)}>{logLabel(l)}</option>}</For>
          </select>
        </label>
        <label>
          快检结果
          <select
            value={form().result}
            onChange={(e) => setForm({ ...form(), result: e.currentTarget.value as ContamResult })}
          >
            <For each={results}>{(r) => <option value={r}>{r}</option>}</For>
          </select>
        </label>
        <label>
          快检时间
          <input
            type="datetime-local"
            value={form().checkedAt}
            onInput={(e) => setForm({ ...form(), checkedAt: e.currentTarget.value })}
            required
          />
        </label>
        <label class="span-2">
          备注（可空）
          <input
            value={form().message}
            onInput={(e) => setForm({ ...form(), message: e.currentTarget.value })}
          />
        </label>
        <button type="submit" class="btn primary">
          登记快检
        </button>
      </form>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>环境记录</th>
              <th>出菇室</th>
              <th>结果</th>
              <th>快检时间</th>
              <th>备注</th>
            </tr>
          </thead>
          <tbody>
            <For each={rows()}>
              {(c) => {
                const log = logById().get(c.climateLogId)
                const room = log ? roomById().get(log.roomId) : undefined
                return (
                  <tr>
                    <td>{c.id}</td>
                    <td>#{c.climateLogId}</td>
                    <td>{room ? `${room.roomCode} · ${room.species}` : '—'}</td>
                    <td>
                      <span class={`badge ${c.result}`}>{c.result}</span>
                    </td>
                    <td>{new Date(c.checkedAt).toLocaleString()}</td>
                    <td>{c.message || '—'}</td>
                  </tr>
                )
              }}
            </For>
          </tbody>
        </table>
      </div>
    </div>
  )
}
