import { render, screen, fireEvent } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { TutorPanel } from '../../src/tutor/TutorPanel.tsx'
import { AiConnectionController } from '../../src/ai/connection-controller.ts'

it('offers one gateway setup and leaves Study accessible before pairing', async () => {
  const connection = new AiConnectionController()
  const authorize = vi.spyOn(connection, 'authorize').mockResolvedValue()
  const onStudy = vi.fn()
  render(<TutorPanel bookId="book" tools={[]} connection={connection} open onStudy={onStudy} onClose={() => {}} />)
  const connect = await screen.findByRole('button', { name: 'Connect with Agent Connect' })
  expect(connect).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Gateway address'), { target: { value: 'gateway.example' } })
  fireEvent.click(connect)
  expect(authorize).toHaveBeenCalledWith(expect.objectContaining({
    intent: { feature: 'tutor', bookId: 'book', draft: '' },
  }))
  fireEvent.click(screen.getByRole('button', { name: 'View Study' }))
  expect(onStudy).toHaveBeenCalledTimes(1)
})
