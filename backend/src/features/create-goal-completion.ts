import { and, count, eq, gte, lte, sql } from 'drizzle-orm'
import { db } from '../db'
import { goalCompletions, goals } from '../db/schema'
import dayjs from 'dayjs'

interface CreateGoalCompletionRequest {
  goalId: string
}

export async function createGoalCompletion({
  goalId,
}: CreateGoalCompletionRequest) {
  const firstDayofWeek = dayjs().startOf('week').toDate()
  const lastDayofWeek = dayjs().endOf('week').toDate()

  const goalCompletionsCounts = db.$with('goal_completions_counts').as(
    db
      .select({
        goalId: goalCompletions.goalId,
        completionCount: count(goalCompletions.id).as('completionCount'),
      })
      .from(goalCompletions)
      .where(
        and(
          gte(goalCompletions.completedAt, firstDayofWeek),
          lte(goalCompletions.completedAt, lastDayofWeek),
          eq(goalCompletions.goalId, goalId)
        )
      )
      .groupBy(goalCompletions.goalId)
  )

  const query = await db
    .with(goalCompletionsCounts)
    .select({
      desiredWeeklyFrequency: goals.desiredWeeklyFrequency,
      completionCount:
        sql`COALESCE(${goalCompletionsCounts.completionCount}, 0)`.mapWith(
          Number
        ),
    })
    .from(goals)
    .leftJoin(goalCompletionsCounts, eq(goals.id, goalCompletionsCounts.goalId))
    .where(eq(goals.id, goalId))
    .limit(1)

  const { completionCount, desiredWeeklyFrequency } = query[0]

  if (completionCount >= desiredWeeklyFrequency) {
    throw new Error('Goal already completed for the week')
  }

  const result = await db.insert(goalCompletions).values({ goalId }).returning()
  const goalCompletion = result[0]
  return { goalCompletion }
}
