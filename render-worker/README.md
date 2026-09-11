# Setlog render worker

The one piece of Setlog that cannot run on the phone.

`expo-video` plays and `expo-camera` records; neither concatenates, and no
ffmpeg ships in the app. So stitching a day of clips into a single video
happens here: the app writes a row into `setlog_renders`, this worker picks
it up, encodes, and puts the file back in the `setlog-clips` bucket.

## What it does

1. Claims the oldest `queued` row (an atomic `queued → rendering` update, so
   two workers can run without racing).
2. Downloads that day's clips with the service role.
3. Builds one segment per group of `split` clips — each pane scaled to fit
   its slice and padded onto the chosen background, with the clock and title
   drawn where the app draws them.
4. Concatenates the segments with the concat **demuxer** and `-c copy`.
   Every segment was just encoded here with identical settings, so this
   costs no re-encode — which is why a day finishes in seconds.
5. Overlays the logo if the watermark was asked for.
6. Uploads to `<setlog_id>/<user_id>/exports/<day>-reel-<job>.mp4` and marks
   the row `done`.

A container that dies mid-job leaves its row in `rendering`; after ten
minutes the next worker puts it back on the queue.

## Environment

| Variable | What it is |
|---|---|
| `SUPABASE_URL` | your project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service role — it writes to a table the client can only read |
| `POLL_INTERVAL_MS` | optional, default 3000 |

The service role key must never reach the app. This is the only place it
belongs.

## Deploying

It polls rather than listens, so deploy it as a **worker/background
process**, not a web service — there is no port to health-check.

```bash
# Fly.io
fly launch --no-deploy            # then set [processes] worker = "node index.js"
fly secrets set SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=…
fly deploy

# Cloud Run (as a job, or a service with min-instances=1)
gcloud run deploy setlog-render-worker --source . --no-cpu-throttling \
  --set-env-vars SUPABASE_URL=… --set-secrets SUPABASE_SERVICE_ROLE_KEY=…

# Railway / Render: point at this directory, it builds from the Dockerfile
```

One small instance is enough. A day is typically ten to twenty two-second
clips — a few seconds of CPU.

## Running it locally against the real project

```bash
cd render-worker
npm install
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node index.js
```

Then ask for a reel from the app. This is the quickest way to see the
pipeline work before committing to a host.

## Until it is deployed

Nothing breaks. Jobs sit at `queued`, and the app's `waitForRender` gives up
after three minutes with *"No renderer is running, so the reel can't be
built yet"* rather than spinning behind a progress bar that will never move.
The collage export is on-device and works regardless.
