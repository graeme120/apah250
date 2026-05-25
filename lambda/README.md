# APAH 250 Upload Lambda — deployment guide

This Lambda accepts an image + artwork number from the site, uploads the image
to your S3 bucket, and updates the `src` column of your Google Sheet so the
new photo appears on the site.

It's a single file with **zero npm dependencies** — copy/paste into the AWS
Lambda console, no zip required.

---

## 1. Create a Google service account (for the Sheets write)

A service account is a "robot" Google identity that can edit the sheet without
your personal credentials needing to live in the Lambda.

1. Go to <https://console.cloud.google.com/> and sign in with the Google
   account that **owns the spreadsheet**.
2. Create a new project (or pick an existing personal one) — name it whatever
   you want, e.g. `apah250-uploader`.
3. In the search bar, find **"Google Sheets API"** → click **Enable**.
4. Side menu → **IAM & Admin** → **Service Accounts** → **+ Create service
   account**. Name it `apah250-writer`. Click **Create and continue**, skip the
   "grant access" steps, click **Done**.
5. Click the new service account → **Keys** tab → **Add key** → **Create new
   key** → choose **JSON** → **Create**. A JSON file downloads — keep it safe;
   it's the private key.
6. Copy the service account's email (looks like
   `apah250-writer@apah250-uploader.iam.gserviceaccount.com`).
7. Open your Google Sheet → **Share** → paste that email → grant **Editor**
   access → uncheck "Notify people" → **Share**.

## 2. Create the Lambda

1. AWS Console → **Lambda** → **Create function** → **Author from scratch**.
2. Function name: `apah250-upload`
3. Runtime: **Node.js 20.x** (or 22.x)
4. Architecture: `arm64` (cheaper) or `x86_64` — either is fine.
5. Permissions: **Create a new role with basic Lambda permissions**.
6. Click **Create function**.

In the editor that appears:

1. Replace the contents of `index.mjs` with the contents of this directory's
   [`index.mjs`](./index.mjs).
2. **Deploy** (the orange button).

## 3. Give the Lambda permission to write to S3

1. In the function page → **Configuration** tab → **Permissions** → click the
   execution role name (opens IAM in a new tab).
2. **Add permissions** → **Create inline policy** → JSON tab → paste:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["s3:PutObject"],
         "Resource": "arn:aws:s3:::image-gosting/web_apah-250/*"
       }
     ]
   }
   ```

3. Click **Next** → name it `apah250-s3-write` → **Create policy**.

## 4. Set environment variables

Back in the Lambda function → **Configuration** → **Environment variables** →
**Edit**:

- `UPLOAD_PASSWORD` = `apah250`
- `GOOGLE_SERVICE_ACCOUNT_JSON` = paste the entire contents of the service
  account JSON file you downloaded in step 1. (It's a one-line escaped JSON
  string — copy-paste the file's contents directly; AWS stores it as a single
  value.)

Save.

## 5. Create a Function URL (the HTTPS endpoint)

1. **Configuration** → **Function URL** → **Create function URL**.
2. Auth type: **NONE** (the password in the request body is the auth).
3. Expand **Additional settings** → check **Configure cross-origin resource
   sharing (CORS)**.
4. Set:
   - Allow origin: `*` (or your specific domain once deployed)
   - Allow methods: `POST`  (AWS auto-responds to the OPTIONS preflight,
     so you don't need to add it here — the console won't even let you.)
   - Allow headers: `content-type`
5. **Save**. Copy the function URL — it looks like
   `https://abcdef123456.lambda-url.us-east-1.on.aws/`.

## 6. Wire the URL into the site

Open `index.html` and find this line near the top of `<script>`:

```js
const UPLOAD_URL = "";
```

Paste the function URL inside the quotes, save, reload.

## 7. Verify

1. Open the site → click any "not yet found" tile → modal opens.
2. There should be an **+ Upload photo** button below the blurb.
3. Click it, pick a photo, enter password `apah250` when prompted (it'll be
   saved locally for next time).
4. After upload completes, the image should swap in within a few seconds.
   (The site's data API caches for ~30s, so it may take up to that long for
   thumbnails on other tiles to reflect the change.)

## Troubleshooting

- **CORS error in browser console** → re-check Function URL CORS config.
- **`Wrong password`** → check `UPLOAD_PASSWORD` env var matches what the site
  sends.
- **`Sheets write 403`** → you forgot to share the sheet with the service
  account's email.
- **`S3 PUT 403`** → IAM policy missing `s3:PutObject` on the bucket prefix,
  or your bucket has a deny policy/ACL.
- **Image uploads but doesn't show on site** → bucket isn't public-read, or
  the bucket has Block Public ACLs turned on (in which case the
  `x-amz-acl: public-read` header will silently fail — you'd need a bucket
  policy granting public read instead).

## Cost

At normal personal use this stays in AWS free tier:
- Lambda: 1M free requests/month + 400k GB-seconds. Each upload is ~1s and a
  few hundred MB-seconds. You'd need to upload thousands of times to notice.
- S3: storage cost on the photos themselves (~$0.023/GB/month).
- Function URL: free.
