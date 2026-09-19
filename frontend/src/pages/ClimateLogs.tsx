import { createMemo, createSignal, onMount } from 'solid-js'
import { For, Show } from 'solid-js'
import { api } from '../api/client'
import type { ClimateLog, ContamCheck, ContamResult, Room } from '../types'

function toLocalInput(iso?: string) {
  const d = iso ? new Date(iso) : new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const empty = {
  roomId: '',
  recordedAt: toLocalInput(),
  tempC: '',
  humidityPct: '',
  co2Ppm: '',
  notes: '',
}

const resultLabels: Record<ContamResult, string> = {
  clear: 'clear（无菌）',
  suspect: 'suspect（可疑）',
  positive: 'positive（检出杂菌）',
}

export default function ClimateLogs() {
  const [rows, setRows] = createSignal<ClimateLog[]>([])
  const [rooms, setRooms] = createSignal<Room[]>([])
  const [checks, setChecks] = createSignal<ContamCheck[]>([])
  const [form, setForm] = createSignal({ ...empty })
  const [error, setError] = createSignal('')

  // 正在登记快检的环境记录 ID + 快检表单
  const [checkingId, setCheckingId] = createSignal<number | null>(null)
  const [checkForm, setCheckForm] = createSignal({
    result: 'suspect' as ContamResult,
    checkedAt: toLocalInput(),
    message: '',
  })
  const [checkError, setCheckError] = createSignal('')

  const checkByLog = createMemo(() => {
    const m = new Map<number, ContamCheck>()
    for (const c of checks()) m.set(c.climateLogId, c)
    return m
  })

  function roomOf(id: number): Room | undefined {
    return rooms().find((r) => r.id === id)
  }

  async function load() {
    const [logs, roomList, checkList] = await Promise.all([
      api<ClimateLog[]>('/api/climate-logs'),
      api<Room[]>('/api/rooms'),
      api<ContamCheck[]>('/api/contam-checks'),
    ])
    setRows(logs)
    setRooms(roomList)
    setChecks(checkList)
  }

  onMount(() => {
    load().catch((e) => setError(e.message))
  })

  async function onSubmit(e: Event) {
    e.preventDefault()
    setError('')
    try {
      await api('/api/climate-logs', {
        method: 'POST',
        body: JSON.stringify({
          roomId: Number(form().roomId),
          recordedAt: new Date(form().recordedAt).toISOString(),
          tempC: Number(form().tempC),
          humidityPct: Number(form().humidityPct),
          co2Ppm: form().co2Ppm ? Number(form().co2Ppm) : null,
          notes: form().notes || null,
        }),
      })
      setForm({ ...empty, recordedAt: toLocalInput() })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    }
  }

  async function remove(id: number) {
    if (!confirm('确认删除该环境记录？')) return
    try {
      await api(`/api/climate-logs/${id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
  }

  function openCheck(logId: number) {
    setCheckError('')
    setCheckForm({ result: 'suspect', checkedAt: toLocalInput(), message: '' })
    setCheckingId(logId)
  }

  async function submitCheck(logId: number) {
    setCheckError('')
    try {
      await api('/api/contam-checks', {
        method: 'POST',
        body: JSON.stringify({
          climateLogId: logId,
          result: checkForm().result,
          checkedAt: new Date(checkForm().checkedAt).toISOString(),
          message: checkForm().message || null,
        }),
      })
      setCheckingId(null)
      // positive 会在后端把所属室联动为 sanitize，整表刷新拿到新室态
      await load()
    } catch (err) {
      setCheckError(err instanceof Error ? err.message : '快检登记失败')
    }
  }

  return (
    <div>
      <header class="page-header">
        <h1>环境记录</h1>
        <p class="muted">温湿度与 CO₂；湿度须 1–100。每条记录可挂一条杂菌快检，positive 联动该室进入 sanitize</p>
      </header>
      {error() && <div class="error">{error()}</div>}

      <form class="panel form-grid" onSubmit={onSubmit}>
        <label>
          出菇室
          <select
            value={form().roomId}
            onChange={(e) => setForm({ ...form(), roomId: e.currentTarget.value })}
            required
          >
            <option value="">选择出菇室</option>
            <For each={rooms()}>
              {(r) => (
                <option value={String(r.id)}>
                  {r.roomCode} · {r.species}
                </option>
              )}
            </For>
          </select>
        </label>
        <label>
          记录时间
          <input
            type="datetime-local"
            value={form().recordedAt}
            onInput={(e) => setForm({ ...form(), recordedAt: e.currentTarget.value })}
            required
          />
        </label>
        <label>
          温度 (°C)
          <input
            type="number"
            step="0.1"
            value={form().tempC}
            onInput={(e) => setForm({ ...form(), tempC: e.currentTarget.value })}
            required
          />
        </label>
        <label>
          湿度 (%)
          <input
            type="number"
            min="1"
            max="100"
            value={form().humidityPct}
            onInput={(e) => setForm({ ...form(), humidityPct: e.currentTarget.value })}
            required
          />
        </label>
        <label>
          CO₂ (ppm)
          <input
            type="number"
            step="1"
            value={form().co2Ppm}
            onInput={(e) => setForm({ ...form(), co2Ppm: e.currentTarget.value })}
          />
        </label>
        <label class="span-2">
          备注
          <input
            value={form().notes}
            onInput={(e) => setForm({ ...form(), notes: e.currentTarget.value })}
          />
        </label>
        <button type="submit" class="btn primary">
          新增记录
        </button>
      </form>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>出菇室</th>
              <th>时间</th>
              <th>温度</th>
              <th>湿度</th>
              <th>CO₂</th>
              <th>杂菌快检</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <For each={rows()}>
              {(r) => {
                const check = () => checkByLog().get(r.id)
                const room = () => roomOf(r.roomId)
                return (
                  <>
                    <tr>
                      <td>{r.id}</td>
                      <td>
                        {r.roomId}
                        <Show when={room()}>
                          <span class="muted"> · {room()!.roomCode}</span>
                        </Show>
                        <Show when={room()?.status === 'sanitize'}>
                          <span class="badge sanitize">sanitize</span>
                        </Show>
                      </td>
                      <td>{new Date(r.recordedAt).toLocaleString()}</td>
                      <td>{r.tempC}</td>
                      <td>{r.humidityPct}%</td>
                      <td>{r.co2Ppm ?? '—'}</td>
                      <td>
                        <Show
                          when={check()}
                          fallback={
                            <button
                              type="button"
                              class="btn ghost"
                              onClick={() => openCheck(r.id)}
                            >
                              登记快检
                            </button>
                          }
                        >
                          {(c) => (
                            <div>
                              <span class={`badge contam-${c().result}`}>{c().result}</span>
                              <div class="hint">{new Date(c().checkedAt).toLocaleString()}</div>
                              <Show when={c().message}>
                                <div class="hint">{c().message}</div>
                              </Show>
                            </div>
                          )}
                        </Show>
                      </td>
                      <td>
                        <button type="button" class="btn ghost" onClick={() => remove(r.id)}>
                          删除
                        </button>
                      </td>
                    </tr>
                    <Show when={checkingId() === r.id}>
                      <tr>
                        <td colSpan={8}>
                          <div class="check-editor panel">
                            <Show when={checkError()}>
                              <div class="error">{checkError()}</div>
                            </Show>
                            <label>
                              快检结果
                              <select
                                value={checkForm().result}
                                onChange={(e) =>
                                  setCheckForm({
                                    ...checkForm(),
                                    result: e.currentTarget.value as ContamResult,
                                  })
                                }
                              >
                                <For each={Object.keys(resultLabels) as ContamResult[]}>
                                  {(v) => <option value={v}>{resultLabels[v]}</option>}
                                </For>
                              </select>
                            </label>
                            <label>
                              检查时间
                              <input
                                type="datetime-local"
                                value={checkForm().checkedAt}
                                onInput={(e) =>
                                  setCheckForm({ ...checkForm(), checkedAt: e.currentTarget.value })
                                }
                              />
                            </label>
                            <label>
                              说明（可空）
                              <input
                                value={checkForm().message}
                                onInput={(e) =>
                                  setCheckForm({ ...checkForm(), message: e.currentTarget.value })
                                }
                              />
                            </label>
                            <div class="check-actions">
                              <button
                                type="button"
                                class="btn primary"
                                onClick={() => submitCheck(r.id)}
                              >
                                提交快检
                              </button>
                              <button
                                type="button"
                                class="btn ghost"
                                onClick={() => setCheckingId(null)}
                              >
                                取消
                              </button>
                              <span class="hint">positive 将联动该室进入 sanitize；idle 室会被拒绝</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </Show>
                  </>
                )
              }}
            </For>
          </tbody>
        </table>
      </div>
    </div>
  )
}
