# n8n-nodes-unsora

This is an [n8n](https://n8n.io) community node for [Unsora](https://tryunsora.com). Unsora is a social media scheduler with AI built in. Use it to schedule and publish posts to TikTok, YouTube, Instagram, Pinterest, Facebook and other social networks, and to turn long videos into short clips and generate AI video, images, music, voiceovers and thumbnails, all from your n8n workflows.

The package contains two nodes:

- **Unsora**: every Unsora API operation. It also works as a tool for the n8n AI Agent.
- **Unsora Trigger**: starts a workflow when a clipping finishes or when a post is published or fails.

[Installation](#installation) · [Credentials](#credentials) · [Operations](#operations) · [Unsora Trigger](#unsora-trigger) · [Example workflow](#example-workflow) · [Compatibility](#compatibility) · [Resources](#resources)

## Installation

### n8n Cloud and self-hosted, after verification

1. Open the nodes panel (**+** in the top right of the editor).
2. Search for **Unsora**.
3. Select the Unsora node and click **Install**.

### Self-hosted, any time

1. Go to **Settings → Community Nodes**.
2. Click **Install a community node**.
3. Enter `n8n-nodes-unsora`, accept the risk notice and click **Install**.

You can also install it from the command line in your n8n user folder (usually `~/.n8n/nodes`):

```bash
npm install n8n-nodes-unsora
```

Then restart n8n. Full instructions: [n8n community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/).

## Credentials

The nodes authenticate with an Unsora API key.

1. Sign in to Unsora and open [app.tryunsora.com/api-keys](https://app.tryunsora.com/api-keys).
2. Create a key. It starts with `uns_`.
3. In n8n, add an **Unsora API** credential and paste the key into **API Key**.
4. Leave **Base URL** at `https://mvp.tryunsora.com/api/v1` unless Unsora support tells you otherwise.

n8n tests the key by reading your credit balance (`GET /user/credits`).

### Custom API calls

For an endpoint the node does not cover, use the **HTTP Request** node: set **Authentication** to **Predefined Credential Type**, pick **Unsora API**, and call any URL under `https://mvp.tryunsora.com/api/v1`. The API key is added for you. See the [API reference](https://tryunsora.com/docs) for the endpoints.

## Operations

| Resource | Operations |
| --- | --- |
| **Account** | List accounts · List Pinterest boards · Get TikTok creator info |
| **AI Influencer** | Create influencer images · List · Delete |
| **Clipping** | Create clipping · Get clipping status · Get clipping · List clippings · Delete clipping · Delete clip |
| **Image** | Create image · Get image · Get image status · List images · Delete image |
| **Music** | Create music · Get music status · List music · Delete music |
| **Post** | Create post · Get post · List posts · Update post · Publish post now · Retry post · Delete post · Get post analytics |
| **Thumbnail** | Create thumbnail · Get thumbnail · List thumbnails · Delete thumbnail |
| **Upload** | Upload from URL · Upload file (binary) · List uploads · Delete upload |
| **User** | Get credits · Get subscription |
| **Video** | Create video · Get video status · List videos · Delete video |
| **Voiceover** | Create voiceover · Get voiceover status · List voiceovers · List voices · Delete voiceover |

### Wait for Completion

Clipping, video, image, music, voiceover, thumbnail and AI influencer jobs run in the background. Their **Create** operations have a **Wait for Completion** option, on by default:

- **On**: the node checks the job status until it finishes and outputs the final result, such as the clips or the output URL. The poll interval defaults to 15 seconds for clipping and 10 seconds for everything else, and never goes below 5 seconds. The timeout defaults to 30 minutes for clipping and 10 minutes for everything else. If the job fails, the node raises an error with the reason. If the timeout passes first, the node raises an error that includes the job ID; the job keeps running in Unsora.
- **Off**: the node outputs the job ID straight away. Check it later with **Get Status**, or use the **Unsora Trigger**.

Thumbnail and AI influencer jobs can create several images. When the node waits for them, it outputs one item per image.

Every clip in a clipping result has a `clipUrl` field, which you can map straight into **Post → Create → Video URL**.

### Music

Every model except **Mureka 7.5 (Instrumental)** makes a song with vocals and needs **Lyrics**. For background music without vocals, choose **Mureka 7.5 (Instrumental)** and describe the track in **Style Prompt**.

### Uploads

- **Upload From URL**: Unsora downloads the file from a public URL, up to 200 MB.
- **Upload File (binary)**: files up to 5 MB are sent in one request. Larger files are uploaded straight to Unsora storage through a one-time upload link, then added to your library. The whole file is held in n8n's memory while it uploads, so for very large videos prefer **Upload From URL**.

### Dropdowns

The account, voice, video model, image model and Pinterest board fields load their options from your Unsora account. To set them dynamically, switch the field to an expression and pass the ID.

### Posts

**Post → Create** covers what the scheduler supports:

- Up to 10 accounts per post, across platforms.
- Media: a video, one image, several images (a carousel), or text only.
- **When to Publish**: Schedule (a date and time at least 2 minutes ahead, read in the workflow's time zone unless it includes an offset), Publish Now, or Save as Draft.
- **Per-Account Overrides**: a custom caption or YouTube title for specific accounts.
- **Platform Options** for TikTok, YouTube, Instagram, Pinterest and Google Business Profile.
- **Additional Body (JSON)**: extra API fields that are merged into the request as they are.

**Post** outputs use the same upper-case values everywhere, for example `status: SCHEDULED` and `type: CAROUSEL`. With **Publish Now**, the post is created as a draft and then published. If publishing fails, the error names the draft's ID so you can fix it and use **Publish**, or delete it. If a retried item (same Idempotency Key or External ID) finds the post already publishing or published, the node reports that instead of failing.

### Rate limits and errors

The Unsora API allows 60 requests per minute per API key. The node retries a rate-limited (429) request up to twice, with a backoff that grows on each attempt (status checks while waiting retry up to 5 times). Other API errors show the HTTP status, the Unsora error code and the message, with a hint for common cases: 401 means an invalid key, 402 means not enough credits, and 403 means your plan does not include the feature. Turn on **Settings → On Error → Continue** to keep processing the remaining items when one fails.

Create operations accept an optional **Idempotency Key**. Sending the same key again within 24 hours returns the original response instead of creating a duplicate, so retries are safe.

## Unsora Trigger

A polling trigger. Set how often it checks under **Poll Times**.

| Event | Fires when |
| --- | --- |
| Clipping Completed | A clipping job reaches `COMPLETED`. The output includes `clips[]`. |
| Post Published | A post reaches `PUBLISHED`, meaning every account published. |
| Post Failed | A post reaches `FAILED`, meaning no account published. If you retry the post and it fails again, the event fires again. |

The first poll after you activate the workflow records the existing events without firing, so you only get new ones. Each poll compares the 100 most recently changed records, and events from before activation never fire, however long your history is. A manual test run returns the most recent matching event so you can map its fields.

## Example workflow

**Clip a YouTube video, then schedule each clip to TikTok one hour apart.** The workflow is also saved as [`examples/clip-youtube-to-tiktok.json`](examples/clip-youtube-to-tiktok.json).

1. Copy the JSON below and paste it into an empty n8n workflow with Ctrl+V / Cmd+V.
2. Select your Unsora credential on both Unsora nodes.
3. Replace `YOUR_VIDEO_ID` with your video, and pick your TikTok account in **Schedule to TikTok → Accounts**.

```json
{
	"name": "Clip a YouTube video and schedule the clips to TikTok",
	"nodes": [
		{
			"parameters": {},
			"name": "When clicking 'Execute workflow'",
			"type": "n8n-nodes-base.manualTrigger",
			"typeVersion": 1,
			"position": [0, 0]
		},
		{
			"parameters": {
				"resource": "clipping",
				"operation": "create",
				"videoUrl": "https://www.youtube.com/watch?v=YOUR_VIDEO_ID",
				"targetDuration": "30-60",
				"ratio": "9:16",
				"additionalFields": { "maxClips": 5, "enableCaption": true, "captionStyle": "bold-white" },
				"waitForCompletion": true,
				"pollInterval": 15,
				"timeout": 30
			},
			"name": "Create Clipping",
			"type": "n8n-nodes-unsora.unsora",
			"typeVersion": 1,
			"position": [220, 0]
		},
		{
			"parameters": { "fieldToSplitOut": "clips", "options": {} },
			"name": "One Item per Clip",
			"type": "n8n-nodes-base.splitOut",
			"typeVersion": 1,
			"position": [440, 0]
		},
		{
			"parameters": {
				"resource": "post",
				"operation": "create",
				"accounts": ["YOUR_TIKTOK_ACCOUNT_ID"],
				"caption": "={{ $json.title || 'New clip' }} #fyp #shorts",
				"mediaType": "video",
				"videoUrl": "={{ $json.clipUrl }}",
				"publishMode": "schedule",
				"scheduledAt": "={{ $now.plus({ hours: $itemIndex + 1 }).toISO() }}",
				"platformSettings": { "tiktok": { "privacyLevel": "PUBLIC_TO_EVERYONE", "isAigc": true } },
				"additionalFields": {}
			},
			"name": "Schedule to TikTok",
			"type": "n8n-nodes-unsora.unsora",
			"typeVersion": 1,
			"position": [660, 0]
		}
	],
	"connections": {
		"When clicking 'Execute workflow'": { "main": [[{ "node": "Create Clipping", "type": "main", "index": 0 }]] },
		"Create Clipping": { "main": [[{ "node": "One Item per Clip", "type": "main", "index": 0 }]] },
		"One Item per Clip": { "main": [[{ "node": "Schedule to TikTok", "type": "main", "index": 0 }]] }
	},
	"settings": {}
}
```

Other ideas:

- **Unsora Trigger (Clipping Completed) → Unsora (Post → Create)**: post every new clip automatically.
- **Unsora Trigger (Post Failed) → Slack**: get an alert when a post fails, then **Post → Retry** it.
- **AI Agent + Unsora tool**: ask an agent to "clip this podcast and schedule the best three clips for tomorrow morning".
- **Google Sheets → Unsora (Video → Create) → Unsora (Post → Create)**: generate and schedule AI videos from a content calendar.

## Compatibility

- Requires n8n 1.x or later with community nodes enabled. Using the node as an AI Agent tool needs a recent n8n release that supports community tools.
- Built and tested with `@n8n/node-cli` 0.54.5 and `n8n-workflow` 2.x.
- Has no runtime dependencies.

## Development

```bash
npm install
npm run lint     # n8n community node lint rules
npm run build    # compile to dist/
npm test         # unit tests (mocked HTTP, no live API calls)
npm run dev      # run n8n locally with this node loaded
```

See [PUBLISHING.md](PUBLISHING.md) for the release process.

## Resources

- [Unsora](https://tryunsora.com) · [Unsora app](https://app.tryunsora.com) · [Unsora API docs](https://tryunsora.com/docs)
- [Create an API key](https://app.tryunsora.com/api-keys)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Issues and feature requests](https://github.com/Shipped-Studio/n8n-nodes-unsora/issues)

## License

[MIT](LICENSE.md) © Shipped Studio
