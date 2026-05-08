# HomeworkPlanner

HomeworkPlanner is a browser-based AI-assisted homework planner built for an A/B rotation school schedule.

## What it does

- Understands a fixed school day from `8:00 AM - 3:30 PM`
- Uses four class periods:
  - `8:00 - 9:23`
  - `9:23 - 11:00`
  - `12:00 - 1:23`
  - `1:23 - 2:50`
- Knows lunch is `11:00 AM - 12:00 PM`
- Knows the bus ride is `2:50 PM - 3:30 PM`
- Lets you set custom A Day and B Day classes
- Lets you add homework, tests, essays, projects, quizzes, studying blocks, and other assignments
- Tracks assigned date, due date, estimated hours, notes, and manual priority
- Tracks optional assignment URLs and clearly shows when no link is attached
- Lets you block unavailable time with one-time or repeating busy events
- Generates an AI-style study plan based on due date, priority, workload, and available time
- Warns you when there is more work than time
- Includes optional account and cloud-sync support for using the planner across multiple devices

## How to use it

1. Open `index.html` in a browser.
2. Enter a known A Day and fill in your classes for both rotations.
3. Add assignments with estimated hours and priority.
4. Add busy times for sports, appointments, clubs, work, or anything else that blocks study time.
5. Review the weekly timeline and the AI Planner panel to see what to work on next.

## Multi-device accounts

The app now includes an account system powered by Supabase, but you need to connect your own project before sign-in works.

1. Create a Supabase project.
2. In the Supabase SQL editor, run [`supabase/schema.sql`](/Users/jackjordan/Documents/HomeworkPlanner/supabase/schema.sql).
3. Open [`supabase-config.js`](/Users/jackjordan/Documents/HomeworkPlanner/supabase-config.js) and fill in:
   - `url`
   - `publishableKey`
4. Reload the app.
5. Use the `Account & Sync` card to create an account or sign in.

After that, assignments, busy times, schedule data, planner settings, and the current week offset will sync to the same account and can be opened on multiple devices.

## Notes

- A/B days alternate across school days and skip weekends automatically.
- Weekend planning is enabled with a default focus window starting at `10:00 AM`.
- Study time after school runs until `10:00 PM` by default, but you can change that in Planner Settings.
- Without Supabase configured, all data stays local in the browser with `localStorage`.
