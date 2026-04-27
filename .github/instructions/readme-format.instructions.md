---
applyTo: README.md
description:
  'Use when creating or editing README.md. Enforces README structure, concise section content,
  style, and link/formatting rules.'
---

# README.md Formatting Rules

Always format README.md files with these standards:

## Structure

- Start with project title as # H1 header.
- Add badges for build status, version, and license at the top.
- Use ## H2 for sections: Features, Installation, Usage, Contributing.
- End with a license reference linking to LICENSE.

## Content Guidelines

- Keep descriptions concise, under 100 words per section.
- Include code blocks for examples with language syntax tags (bash, typescript).
- Use relative links for internal files, such as [CONTRIBUTING.md](CONTRIBUTING.md).
- Limit line length to 80 characters.

## Style

- Use active voice.
- Use bullet lists for features and steps.
- Do not use absolute URLs for repository files.
- Keep headings well-structured so table of contents can be auto-generated.

## Example

## Installation

```bash
npm install
npm run build
```
