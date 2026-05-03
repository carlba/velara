---
name: Story
about: Use this template for feature requests and user stories
title: "[Story] "
labels: enhancement
assignees: []
---

# Story: 

As a subscribed user,  
I want to receive an email when my payment fails,  
so that I can fix my billing details and avoid losing access.

## Description

- Triggered when a recurring payment attempt fails.
- Uses our standard email template engine.
- Must be idempotent per invoice and 24-hour window.

## Acceptance criteria

- [ ] When a recurring payment fails, an email is sent to the user’s primary email address.
- [ ] Email contains: product name, last 4 digits of the card, and a link to update billing.
- [ ] For repeated failures on the same invoice, at most one email is sent per 24 hours.
- [ ] If email sending fails, the failure is logged and retried according to our retry policy.

## Technical notes (optional)

- Subscribe to `payment.failed` events from the billing provider.
- Enqueue email jobs on the notifications queue.
- Implement idempotency using `<invoice_id, user_id, date>` key.
