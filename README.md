# Swim Across America — Course Density Modeler

Estimate how many swimmers are on course over time for multi-distance open water events.

## Develop

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy (Vercel)

Push to GitHub and import the repo in Vercel, or run `npx vercel`.

## CSV format

| Column | Required | Description |
|--------|----------|-------------|
| `distance` | yes | Distance / wave label (e.g. `Half`, `1 Mi`, `2 Mi`) |
| `expected_finish_time` | yes | Duration as `H:MM:SS`, `M:SS`, or decimal minutes |
| `name` | no | Optional; each row is a participant either way |

Download template: `public/participant-template.csv`.
