// @vitest-environment node
/**
 * @see https://github.com/mswjs/interceptors/issues/857
 */
import https from 'node:https'
import { setTimeout as sleep } from 'node:timers/promises'
import { ClientRequestInterceptor } from '#/src/interceptors/ClientRequest'

const interceptor = new ClientRequestInterceptor()

beforeAll(() => {
  interceptor.apply()
})

afterEach(() => {
  interceptor.removeAllListeners()
})

afterAll(() => {
  interceptor.dispose()
})

it('does not throw when an https request is destroyed before the mocked connection resolves', async () => {
  interceptor.on('request', ({ controller }) => {
    controller.respondWith(new Response('mocked'))
  })

  /**
   * @note Vitest reports an uncaught exception as a failed run. Collect it
   * here instead so that the test itself fails with the error.
   */
  const vitestListeners = process.listeners('uncaughtException')
  process.removeAllListeners('uncaughtException')
  const uncaughtErrors: Array<Error> = []
  process.on('uncaughtException', (error) => {
    uncaughtErrors.push(error)
  })
  onTestFinished(() => {
    process.removeAllListeners('uncaughtException')
    for (const listener of vitestListeners) {
      process.on('uncaughtException', listener)
    }
  })

  const request = https.get('https://example.com/resource')
  const requestErrors: Array<NodeJS.ErrnoException> = []
  request.on('error', (error) => requestErrors.push(error))
  request.destroy()

  // The emulated connect runs on a later tick, after the request is destroyed.
  await sleep(200)

  expect(uncaughtErrors).toEqual([])
  expect(requestErrors.map((error) => error.code)).toEqual(['ECONNRESET'])
})
