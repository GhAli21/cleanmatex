# CleanMateX Driver App — AI Implementation Rules

## Scope
This app is for drivers and delivery staff.

Main flows include:
- login
- assigned jobs/tasks
- route/task list
- pickup workflow
- delivery workflow
- OTP verification
- proof of delivery
- signature/photo capture
- status updates
- location-aware actions
- offline-tolerant execution

## UX Priorities
- optimize for speed and reliability in the field
- reduce taps and typing
- support one-hand usage where practical
- keep next action obvious
- make sync state visible
- allow work to continue during weak connectivity

## Technical Rules
- Use shared core widgets where suitable, but tailor field workflows for speed
- Use Riverpod for state
- Use repositories for all data access
- Use explicit manual models and serializers
- Queue critical actions when offline tolerance is needed
- Preserve captured delivery evidence until sync succeeds
- Handle camera/location/permission failures cleanly

## Do Not
- block all work because connectivity is poor
- lose photo/signature/OTP data on temporary failure
- hide task-critical actions inside menus
- use generated hidden code
- assume the driver has time to navigate complex UI