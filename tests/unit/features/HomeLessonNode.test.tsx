import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { useAppStore } from '../../../src/shared/store/useAppStore'

const mocks = vi.hoisted(() => ({ instances: [] as Array<{
  inputs: Array<{ name: string; value: boolean | number; fire: ReturnType<typeof vi.fn> }>
  cleanup: ReturnType<typeof vi.fn>
}> }))

vi.mock('@rive-app/webgl2-course', () => {
  class MockRive {
    inputs = ['color', 'dark-mode', 'select', 'completed', 'icon', 'koji_appear'].map((name) => ({ name, value: false as boolean | number, fire: vi.fn() }))
    cleanup = vi.fn()
    resizeDrawingSurfaceToCanvas = vi.fn()
    constructor(config: { onLoad: () => void }) { mocks.instances.push(this); queueMicrotask(config.onLoad) }
    stateMachineInputs() { return this.inputs }
  }
  const api = { Rive: MockRive, RuntimeLoader: { setWasmUrl: vi.fn(), setWasmFallbackUrl: vi.fn() }, Layout: class {}, Fit: { Contain: 'contain' }, Alignment: { Center: 'center' } }
  return { ...api, default: api }
})
vi.mock('@rive-app/webgl2-course/rive.wasm?url', () => ({ default: '/rive.wasm' }))
vi.mock('@rive-app/webgl2-course/rive_fallback.wasm?url', () => ({ default: '/rive-fallback.wasm' }))

import { HomeLessonNode } from '../../../src/features/lessons/HomeLessonNode'

beforeEach(() => {
  mocks.instances.length = 0
  useAppStore.setState({ settings: { ...useAppStore.getState().settings, noAnimation: false } })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }))
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => window.setTimeout(() => callback(0), 0))
})
afterEach(() => { delete document.body.dataset.theme; vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('HomeLessonNode', () => {
  it('sariq darajada sariq orbit va maskotni ishga tushiradi', async () => {
    const view = render(<HomeLessonNode color={4} fallback="/yellow.png" />)
    await waitFor(() => expect(view.container.querySelector('canvas')).toHaveStyle({ visibility: 'visible' }))
    const rive = mocks.instances[0]
    expect(rive.inputs.find((input) => input.name === 'color')?.value).toBe(4)
    expect(rive.inputs.find((input) => input.name === 'select')?.value).toBe(true)
    expect(rive.inputs.find((input) => input.name === 'koji_appear')?.fire).toHaveBeenCalledOnce()
    view.unmount()
    expect(rive.cleanup).toHaveBeenCalledOnce()
  })

  it('animatsiya o‘chirilganda statik belgini ko‘rsatadi', () => {
    useAppStore.setState({ settings: { ...useAppStore.getState().settings, noAnimation: true } })
    const view = render(<HomeLessonNode color={5} fallback="/purple.png" />)
    expect(view.container.querySelector('img')).toHaveAttribute('src', '/purple.png')
    expect(mocks.instances).toHaveLength(0)
  })

  it('o‘tilgan darsga check diskini qo‘yadi va maskotni ko‘chirmaydi', async () => {
    const view = render(<HomeLessonNode color={4} fallback="/darslik-map/node-completed.svg" completed />)
    await waitFor(() => expect(view.container.querySelector('canvas')).toHaveStyle({ visibility: 'visible' }))
    const inputs = mocks.instances[0].inputs
    expect(inputs.find((input) => input.name === 'color')?.value).toBe(4)
    expect(inputs.find((input) => input.name === 'completed')?.value).toBe(true)
    expect(inputs.find((input) => input.name === 'icon')?.value).toBe(1)
    expect(inputs.find((input) => input.name === 'select')?.value).toBe(false)
    expect(inputs.find((input) => input.name === 'koji_appear')?.fire).not.toHaveBeenCalled()
  })

  it('tema o‘zgarganda Rive diskini dark holatga moslaydi', async () => {
    document.body.dataset.theme = 'light'
    const view = render(<HomeLessonNode color={1} fallback="/blue.png" />)
    await waitFor(() => expect(view.container.querySelector('canvas')).toHaveStyle({ visibility: 'visible' }))
    const darkInput = mocks.instances[0].inputs.find((input) => input.name === 'dark-mode')
    expect(darkInput?.value).toBe(false)
    document.body.dataset.theme = 'dark'
    await waitFor(() => expect(darkInput?.value).toBe(true))
  })
})
