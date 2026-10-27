# Issue 42: Retry queue causes duplicate notifications
Two recipients reported duplicates on October 19. We think the queue retries cause them. Remove retries to fix it.
Existing criteria:
- E1: Inspect the retained notification log for October 18–19.
- E2: Attempt a controlled reproduction for at most 20 minutes.
- E3: Deliver a report with evidence, limitations and a recommended next action.
