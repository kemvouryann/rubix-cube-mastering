# Rubik's Cube Mastering

A 3D Rubik's Cube web project with mouse rotation, face turns, move buttons, and Docker Compose support.

## Files

- `index.html` - page structure
- `styles.css` - UI styling
- `script.js` - 3D cube logic with Three.js
- `docker-compose.yml` - local container setup
- `nginx.conf` - web server config for Docker

## Run locally

Open `index.html` in a browser, or run a simple local server:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Run with Docker Compose

```bash
docker compose up
```

Then open:

```text
http://localhost:8080
```

## Controls

- Drag the cube to rotate the view
- Drag stickers to turn cube faces
- Use the move buttons for direct turns
- Use `Scramble` to mix the cube
- Use `Solve` to reset the cube
- Use the arrow buttons to shift the camera view
