# The sync server

One container that carries the Committee Workspace between phones. Host it
yourself, or use the one we run.

## What it is

- **The mailbox.** Members' devices post encrypted updates to a queue named
  after the room key, and pick up what the other devices posted. The server
  never opens a blob. It stores ciphertext, a label it cannot read, a size
  and a time.
- **The matchmaker.** Pairs up the devices in a room so they can talk
  directly. It holds nothing on disk, writes no log line, and forgets every
  room when the process restarts.
- **The store.** A SQLite file on a volume. That is the whole database.

## What it is not

It is not a place where worker data is readable. If somebody breaks into
this process, they get labels, sizes, timings and encrypted blobs. The
names, the ratings, the notes and the evidence stay on the phones.

## Run it

```bash
docker run -d --name oyw-sync \
  -p 8080:8080 \
  -v oyw-sync-data:/data \
  oyw-sync-server:0.1.0
```

Check it:

```bash
curl -s http://localhost:8080/health
```

Build it from the repo:

```bash
docker build -f deploy/sync-server/Dockerfile -t oyw-sync-server:0.1.0 .
```

## The image on GitHub

CI builds it on every push to main and on every tag, and pushes it to
GitHub's container registry:

```bash
docker pull ghcr.io/selfagency/oyw-sync-server:latest
docker pull ghcr.io/selfagency/oyw-sync-server:v0.1.0
```

The pull is public to anyone with a GitHub account. The server holds no
readable data, so there is nothing in it that is not already on a worker's
phone in plain text. If the package should be private, change the
visibility in the package settings; the image builds the same either way.

## The three doors

| Path | What it does |
|---|---|
| `GET /health` | The health check. Returns `{"ok":true}`. |
| `POST /mailbox/queue` | Puts a blob in a queue. Body: `label`, `blob`, `expires_at`. |
| `GET /mailbox/queue?label=…&since=…` | Hands back the blobs after `since`. |
| `DELETE /mailbox/queue?label=…` | Throws away a whole queue. This is what a removal does. |
| `POST /match/challenge` | Asks for a proof-of-work challenge for a room. |
| `POST /match/join` | Joins the signaling room with a solved challenge. |
| `POST /match/message` | Passes an encrypted message to the other peers. |
| `GET /match/pull?room=…&peer=…&since=…` | Pulls the messages for a peer. |
| `POST /match/leave` | Leaves the room. |

The `label` is 22 characters of base64url, and the client derives it from
the room key. The server cannot tell one committee from another.

## The environment

| Variable | Default | What it does |
|---|---|---|
| `PORT` | `8080` | The port the platform points at. |
| `HOST` | `0.0.0.0` | The address to listen on. |
| `DATA_DIR` | `/data` | Where the SQLite file goes. |
| `DB_FILE` | `/data/mailbox.db` | The file itself. |
| `PER_LABEL_PER_MINUTE` | `60` | How many writes one queue label may make in a minute. |
| `PER_IP_PER_MINUTE` | `120` | How many writes one address may make in a minute. |
| `ALLOWED_ORIGINS` | `*` | Which sites the browser may ask from. A comma-separated list to be strict. |
| `POW_DIFFICULTY` | `4` | Proof-of-work difficulty for the matchmaker. |
| `MAX_PEERS` | `8` | How many devices one room may hold. |
| `JOINS_PER_MINUTE` | `10` | How many joins one room may take in a minute. |
| `QUEUE_LIMIT` | `200` | How many messages the matchmaker holds per room. |
| `PB_BASE_URL` | empty | Set it to use a PocketBase instance as the store instead of the file. |
| `PB_TOKEN` | empty | The PocketBase superuser token, when `PB_BASE_URL` is set. |

There is no admin password and no account. The server is a pipe, and a
pipe does not need a door.

## The volume

Mount a volume at `/data`. The queue lives in `/data/mailbox.db`. Without a
volume the data goes away when the container is replaced.

- **Coolify:** add a volume, path `/data`.
- **Railway:** add a volume, mount path `/data`.
- **Fly.io:** `fly volumes create oyw_data` then mount it at `/data`.
- **Render:** a disk mounted at `/data`, or a persistent volume.

## Behind a domain

Put it behind a proxy that terminates TLS. The clients use HTTPS.

```nginx
location / {
  proxy_pass http://127.0.0.1:8080;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

The guard rate limits per address, so the proxy must pass the real address
in `X-Forwarded-For`. Without it every request looks like it comes from the
proxy, and one busy committee could rate-limit the whole server.

## Netlify

Netlify does not run containers. Use Railway, Fly, Render, Coolify or your
own box. The static site itself is on Netlify and does not need this.

## Pointing the app at it

In the app, on the Members and keys screen, there is a **Sync server** box.
Put the address of your server in it and save. The phone then carries the
drive to and from that server. Leave the box empty and the drive stays on
that one phone.

The address of the server we run goes in `src/config.ts`
(`DEFAULT_SYNC_SERVER`). It is empty until the server is deployed, so the
app never reaches for a host that is not there.

## The app and the server

The phone seals every change with a key derived from the room key, and the
queue label is derived from the same room key. So the server gets a label
it cannot read, a blob it cannot open, a size and a time. Two phones with
the same room key see the same chart. A phone with a different room key
sees nothing at all.

## What a breach gives an attacker

- The queue labels, which are hashes of room keys. They cannot be turned
  back into a room.
- The sizes and the times of the blobs.
- The blobs, which are ciphertext.

## Checks after deploying

```bash
curl -s https://your-server/health
```

Then, from a phone, open the app, set the sync server to your URL and make
a change on one phone and see it on the other.
