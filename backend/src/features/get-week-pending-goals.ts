import dayjs from 'dayjs'
import weekOfYear from 'dayjs/plugin/weekOfYear'
import { db } from '../db'
import { goalCompletions, goals } from '../db/schema'
import { lte, count, and, gte, eq, sql } from 'drizzle-orm'

dayjs.extend(weekOfYear)

export async function getWeekPendingGoals() {
  const firstDayofWeek = dayjs().startOf('week').toDate()
  const lastDayofWeek = dayjs().endOf('week').toDate()

  const goalsCreatedUpToWeek = db.$with('goals_created_up_to_week').as(
    db
      .select({
        id: goals.id,
        title: goals.title,
        desiredWeeklyFrequency: goals.desiredWeeklyFrequency,
        createdAt: goals.createdAt,
      })
      .from(goals)
      .where(lte(goals.createdAt, lastDayofWeek))
  )

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
          lte(goalCompletions.completedAt, lastDayofWeek)
        )
      )
      .groupBy(goalCompletions.goalId)
  )

  const pendingGoals = await db
    .with(goalsCreatedUpToWeek, goalCompletionsCounts)
    .select({
      id: goalsCreatedUpToWeek.id,
      title: goalsCreatedUpToWeek.title,
      desiredWeeklyFrequency: goalsCreatedUpToWeek.desiredWeeklyFrequency,
      completionCount:
        sql`COALESCE(${goalCompletionsCounts.completionCount}, 0)`.mapWith(
          Number
        ),
    })
    .from(goalsCreatedUpToWeek)
    .leftJoin(
      goalCompletionsCounts,
      eq(goalsCreatedUpToWeek.id, goalCompletionsCounts.goalId)
    )

  return {
    pendingGoals,
  }
}
