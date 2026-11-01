import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createOctopaiClient } from '../vendor/octopai-api/src/client.ts'
import { SweepGuard } from '../src/logic/sweepGuard.ts'

type Handler = (body: Record<string, unknown>) => { status?: number; json?: unknown; text?: string }

function mockFetch(handler: Handler) {
  const calls: Record<string, unknown>[] = []
  globalThis.fetch = (async (_url: unknown, init: RequestInit) => {
    const body = JSON.parse(String(init.body))
    calls.push(body)
    const { status = 200, json, text } = handler(body)
    const payload = text ?? (json === undefined ? '' : JSON.stringify(json))
    return new Response(status === 204 ? null : payload, { status })
  }) as typeof fetch
  return calls
}

const items = (from: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({ _key: `k${from + i}`, connLogicName: 'c' }))

// A fake catalog of `total` assets served with real offset/limit semantics.
const catalog = (total: number): Handler => (b) => {
  const off = Number(b.offset ?? 0), lim = Number(b.limit ?? total)
  return { json: { items: items(off, Math.max(0, Math.min(lim, total - off))) } }
}

const c = createOctopaiClient('http://x')

test('pages through a catalog larger than one page', async () => {
  const calls = mockFetch(catalog(25_000))
  const all = await c.queryAllAssets('co', 't')
  assert.equal(all.length, 25_000)
  assert.equal(calls.length, 3)
})

test('stops when the server ignores offset (no new keys)', async () => {
  const calls = mockFetch(() => ({ json: { items: items(0, 10_000) } }))
  const all = await c.queryAllAssets('co', 't')
  assert.equal(all.length, 10_000)
  assert.equal(calls.length, 2)
})

test('maxObjects caps the request size and the result', async () => {
  const calls = mockFetch(catalog(5_000))
  const all = await c.queryAllAssets('co', 't', undefined, undefined, 500)
  assert.equal(all.length, 500)
  assert.equal(calls[0].limit, 500)
})

test('invalid maxObjects means no limit', async () => {
  for (const bad of [0, -1, NaN]) {
    mockFetch(catalog(300))
    assert.equal((await c.queryAllAssets('co', 't', undefined, undefined, bad)).length, 300)
  }
})

test('204 with no body is an empty result, not a JSON error', async () => {
  mockFetch(() => ({ status: 204 }))
  assert.deepEqual(await c.queryAllAssets('co', 't'), [])
  const l = await c.queryLineage('co', 't', 'k', 0)
  assert.deepEqual(l.nodes, [])
  assert.deepEqual(l.links, [])
})

test('HTML error bodies are not echoed into the message', async () => {
  mockFetch(() => ({ status: 403, text: '<!DOCTYPE html><html>blocked</html>' }))
  await assert.rejects(c.queryAllAssets('co', 't'), (e: Error) => /blocked by a firewall/.test(e.message) && !/</.test(e.message))
})

test('empty name list does not fetch the catalog', async () => {
  const calls = mockFetch(catalog(10))
  assert.deepEqual(await c.queryAssetsByName('co', 't', []), [])
  assert.equal(calls.length, 0)
})

test('SweepGuard throws when a whole first batch fails, tolerates later failures', () => {
  const rej = { status: 'rejected', reason: new Error('HTTP 401') } as const
  const ok = { status: 'fulfilled', value: 1 } as const
  assert.throws(() => new SweepGuard().record([rej, rej]), /401/)
  const g = new SweepGuard()
  g.record([ok, rej])
  g.record([rej, rej])
  assert.equal(g.failed, 3)
})

test('column query falls back to the other assetType when the first has no column nodes', async () => {
  const col = (n: number) => Array.from({ length: n }, (_, i) => ({ _key: `c${i}`, _id: `Octopai_Column_Nodes_x/c${i}`, assetName: `col${i}` }))
  const obj = [{ _key: 'o1', _id: 'Octopai_Object_Nodes_x/o1' }]
  const calls = mockFetch((b) => ({ json: { items: b.assetType === 1 ? (b.IsMap === false ? [] : obj) : col(3) } }))
  const all = await c.queryAllColumnAssets('co', 't')
  assert.equal(all.length, 3)
  assert.deepEqual(calls.map((x) => x.assetType), [1, 2])
})

test('name search keeps column-shaped hits and drops object-shaped ones', async () => {
  const mixed = [{ _key: 'o1', _id: 'Octopai_Object_Nodes_x/o1' }, { _key: 'c1', _id: 'Octopai_Column_Nodes_x/c1', assetName: 'a' }]
  mockFetch(() => ({ json: { items: mixed } }))
  assert.deepEqual((await c.queryAssetsByName('co', 't', ['a'])).map((i) => i._key), ['c1'])
})

test('name search returns raw hits when nothing is column-shaped', async () => {
  mockFetch(() => ({ json: { items: [{ _key: 'o1', _id: 'Octopai_Object_Nodes_x/o1' }] } }))
  assert.equal((await c.queryAssetsByName('co', 't', ['a'])).length, 1)
})
