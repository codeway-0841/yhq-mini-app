/**
 * Users repository — all DB access for the `users` table.
 * No business logic here; only SQL/Drizzle calls.
 */

import { eq }    from 'drizzle-orm'
import { db }    from '../../db/connection'
import { users } from '../../schema'

export interface CreateOrUpdateUserInput {
  id:        bigint
  firstName: string
  lastName:  string | null
  username:  string | null
  photoUrl:  string | null
}

export const usersRepository = {
  /** Upsert user and return the persisted row. */
  async upsert(input: CreateOrUpdateUserInput) {
    const [row] = await db.insert(users).values({
      id:        input.id,
      firstName: input.firstName,
      lastName:  input.lastName  ?? '',
      username:  input.username  ?? '',
      photoUrl:  input.photoUrl  ?? '',
    }).onConflictDoUpdate({
      target: users.id,
      set: {
        firstName: input.firstName,
        lastName:  input.lastName  ?? '',
        username:  input.username  ?? '',
        photoUrl:  input.photoUrl  ?? '',
        updatedAt: new Date(),
      },
    }).returning()
    return row!
  },

  async findById(id: bigint) {
    const [user] = await db.select().from(users).where(eq(users.id, id))
    return user ?? null
  },

  /**
   * Update phone. Returns true when a row was actually updated.
   * Uses .returning() because neon-http driver does not populate rowCount.
   */
  async updatePhone(id: bigint, phone: string): Promise<boolean> {
    const rows = await db.update(users)
      .set({ phone, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning({ id: users.id })
    return rows.length > 0
  },
}
