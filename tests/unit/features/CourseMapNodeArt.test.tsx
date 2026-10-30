import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'
import { useAppStore } from '../../../src/shared/store/useAppStore'

const mocks = vi.hoisted(() => ({ instances: [] as Array<{
  inputs: Array<{ name: string; value: boolean | number; fire: ReturnType<typeof vi.fn> }>
  cleanup: ReturnType<typeof vi.fn>
  config: { artboard: string; stateMachine: string; useOffscreenRenderer: boolean }
}> }))

vi.mock('@rive-app/webgl2-course', () => {
  class MockRive {
    inputs = ['select', 'color', 'dark-mode', 'level', 'completed', 'icon', 'koji_appear'].map((name) => ({ name, value: false as boolean | number, fire: vi.fn() }))
    cleanup = vi.fn()
    resizeDrawingSurfaceToCanvas = vi.fn()
    config: { artboard: string; stateMachine: string; useOffscreenRenderer: boolean }
    constructor(config: { onLoad: () => void; artboard: string; stateMachine: string; useOffscreenRenderer: boolean }) {
      this.config = config
      mocks.instances.push(this)
      queueMicrotask(config.onLoad)
    }
    stateMachineInputs() { return this.inputs }
  }
  const api = {
    Rive: MockRive,
    RuntimeLoader: { setWasmUrl: vi.fn(), setWasmFallbackUrl: vi.fn() },
    Layout: class {},
    Fit: { Contain: 'contain' },
    Alignment: { Center: 'center' },
  }
  return { ...api, default: api }
})

vi.mock('@rive-app/webgl2-course/rive.wasm?url', () => ({ default: '/rive.wasm' }))
vi.mock('@rive-app/webgl2-course/rive_fallback.wasm?url', () => ({ default: '/rive-fallback.wasm' }))
vi.mock('../../../src/features/lessons', () => ({ PathMascot: () => <span data-testid="fallback-mascot" /> }))

import { CourseMapNodeArt } from '../../../src/features/darslik-rustili/CourseMapNodeArt'

beforeEach(() => {
  mocks.instances.length = 0
  document.body.dataset.theme = 'dark'
  useAppStore.setState({ settings: { ...useAppStore.getState().settings, noAnimation: false } })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }))
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) =>
    window.setTimeout(() => callback(0), 0),
  )
})

afterEach(() => {
  delete document.body.dataset.theme
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('CourseMapNodeArt', () => {
  it('Rive yuklanguncha eski orbit ko‘rinmaydi va xatodan keyin qayta urinadi', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    let finishLoad: (response: Response) => void = () => {}
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { finishLoad = resolve }))
    const first = render(<CourseMapNodeArt current src="/darslik-map/node-active-base.png" />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    await act(async () => { await Promise.resolve() })
    expect(first.container.querySelector('canvas')).toHaveStyle({ visibility: 'hidden' })
    expect(first.getByTestId('fallback-mascot')).toBeInTheDocument()
    expect(first.container.querySelector('.cmap-node-orbit')).toBeNull()
    first.unmount()

    const retry = render(<CourseMapNodeArt current={false} src="/darslik-map/node-puck.svg" />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(retry.container.querySelector('canvas')).toHaveStyle({ visibility: 'hidden' })
    expect(retry.container.querySelector('img')).toHaveAttribute('src', '/darslik-map/node-puck.svg')
    expect(retry.container.querySelector('.cmap-node-orbit')).toBeNull()
    await act(async () => { finishLoad({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) } as Response) })
    await waitFor(() => expect(retry.container.querySelector('canvas')).toHaveStyle({ visibility: 'visible' }))
  })

  it('joriy darsda Rive orbitini va maskotni ishga tushirib, yechilganda tozalaydi', async () => {
    const view = render(<CourseMapNodeArt current src="/darslik-map/node-active-base.png" />)
    await waitFor(() => expect(view.container.querySelector('canvas')).toHaveStyle({ visibility: 'visible' }))

    const rive = mocks.instances[0]
    expect(rive.config).toMatchObject({ artboard: 'Gameboard Node', stateMachine: 'node_all', useOffscreenRenderer: true })
    expect(rive.inputs.find((input) => input.name === 'select')?.value).toBe(true)
    expect(rive.inputs.find((input) => input.name === 'color')?.value).toBe(1)
    expect(rive.inputs.find((input) => input.name === 'dark-mode')?.value).toBe(true)
    expect(rive.inputs.find((input) => input.name === 'koji_appear')?.fire).toHaveBeenCalledOnce()
    expect(view.queryByTestId('fallback-mascot')).toBeNull()
    document.body.dataset.theme = 'light'
    await waitFor(() => expect(rive.inputs.find((input) => input.name === 'dark-mode')?.value).toBe(false))
    view.unmount()
    expect(rive.cleanup).toHaveBeenCalledOnce()
  })

  it('tanlangan boshqa darsda Rive yorug‘ diskni chizadi va maskot unga ko‘chmaydi', async () => {
    const view = render(<CourseMapNodeArt current={false} src="/darslik-map/node-puck.svg" />)
    await waitFor(() => expect(view.container.querySelector('canvas')).toHaveStyle({ visibility: 'visible' }))

    expect(mocks.instances[0].inputs.find((input) => input.name === 'koji_appear')?.fire).not.toHaveBeenCalled()
    expect(mocks.instances[0].inputs.find((input) => input.name === 'select')?.value).toBe(true)
    expect(mocks.instances[0].inputs.find((input) => input.name === 'completed')?.value).toBe(false)
    expect(view.container.querySelector('img')).toBeNull()
    expect(view.container.querySelector('.cmap-node-orbit')).toBeNull()
  })

  it('bo‘lim tekshiruvi yulduz shaklidagi Rive orbitini ko‘rsatadi', async () => {
    const view = render(<CourseMapNodeArt current={false} src="/darslik-map/node-check.svg" levelReview />)
    await waitFor(() => expect(view.container.querySelector('canvas')).toHaveStyle({ visibility: 'visible' }))
    const inputs = mocks.instances[0].inputs
    expect(inputs.find((input) => input.name === 'level')?.value).toBe(true)
    expect(inputs.find((input) => input.name === 'select')?.value).toBe(true)
    expect(inputs.find((input) => input.name === 'completed')?.value).toBe(false)
    expect(inputs.find((input) => input.name === 'icon')?.value).toBe(0)
    expect(inputs.find((input) => input.name === 'koji_appear')?.fire).not.toHaveBeenCalled()
    expect(view.container.querySelector('img')).toBeNull()
  })

  it('animatsiya o‘chirilganda bo‘lim tekshiruvining yulduzini ko‘rsatadi', () => {
    useAppStore.setState({ settings: { ...useAppStore.getState().settings, noAnimation: true } })
    const view = render(<CourseMapNodeArt current={false} src="/darslik-map/node-check.svg" levelReview />)
    expect(view.container.querySelector('canvas')).toHaveStyle({ visibility: 'hidden' })
    expect(view.container.querySelector('img')).toHaveAttribute('src', '/darslik-map/node-check.svg')
  })

  it('tanlangan tugallangan darsda Rive checkni chizadi, qo‘shimcha disk qo‘yilmaydi', async () => {
    const view = render(<CourseMapNodeArt current={false} completed src="/darslik-map/node-completed.svg" />)
    await waitFor(() => expect(view.container.querySelector('canvas')).toHaveStyle({ visibility: 'visible' }))

    const rive = mocks.instances[0]
    expect(rive.inputs.find((input) => input.name === 'completed')?.value).toBe(true)
    expect(rive.inputs.find((input) => input.name === 'icon')?.value).toBe(1)
    expect(rive.inputs.find((input) => input.name === 'koji_appear')?.fire).not.toHaveBeenCalled()
    expect(view.container.querySelector('img')).toBeNull()
  })

  it('animatsiya o‘chirilganda zaxira ko‘rinishni ko‘rsatadi', () => {
    useAppStore.setState({ settings: { ...useAppStore.getState().settings, noAnimation: true } })
    const view = render(<CourseMapNodeArt current src="/darslik-map/node-active-base.png" />)

    expect(view.container.querySelector('canvas')).toHaveStyle({ visibility: 'hidden' })
    expect(view.container.querySelector('.cmap-node-orbit')).toBeNull()
    expect(view.container.querySelector('img')).toHaveAttribute('src', '/darslik-map/node-active-base.png')
    expect(view.getByTestId('fallback-mascot')).toBeInTheDocument()
    expect(mocks.instances).toHaveLength(0)
  })
})
