import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import WebGL from 'three/addons/capabilities/WebGL.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPixelatedPass} from 'three/addons/postprocessing/RenderPixelatedPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {GlitchPass} from 'three/addons/postprocessing/GlitchPass.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';

const messages = [];
let messages_len = 0;
let initial_state;
let server_dt = 1;
let server_last_update = new Date();
let game_over = false;
const wsScheme = window.location.protocol === "https:" ? "wss" : "ws";


window.game_online = {
	animation_frame: 0,
	gameUUID: 0,
	game_socket: 0,
	stop() {
		if (this.animation_frame != 0)
			cancelAnimationFrame(this.animation_frame);
		messages.length = 0;
		messages_len = 0;
		server_dt = 1;
		if (this.game_socket != 0)
			this.game_socket.close();
	},
	game() {
		const font = new FontFaceObserver('Press Start 2P');

		font.load().then(() => {
			if (WebGL.isWebGLAvailable()) {
				// RENDERER, CAMERA AND LIGHT
				const container = document.getElementById("pongCanvasOnline");
				if (container === null)
					return;
				const scene = new THREE.Scene();
				const camera = new THREE.PerspectiveCamera(45, container.offsetWidth / container.offsetHeight, 0.1, 1000);
				const renderer = new THREE.WebGLRenderer({antialias: false, alpha: true});
				const controls = new OrbitControls(camera, renderer.domElement);
				controls.enablePan = false;
				controls.maxAzimuthAngle = Math.PI / 4;
				controls.minAzimuthAngle = -Math.PI / 4;
				controls.maxPolarAngle = 3 * Math.PI / 4;
				controls.minPolarAngle = Math.PI / 4;
				controls.minDistance = 75;
				controls.maxDistance = 150;
				const bloom_threshold = 0;
				const bloom_strength = 0.35;
				const bloom_radius = 0;
				const composer = new EffectComposer(renderer);
				const renderPixelatedPass = new RenderPixelatedPass(2, scene, camera);
				composer.addPass(renderPixelatedPass);
				const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
				bloomPass.threshold = bloom_threshold;
				bloomPass.strength = bloom_strength;
				bloomPass.radius = bloom_radius;
				const outputPass = new OutputPass();
				composer.addPass(bloomPass);
				const glitchPass = new GlitchPass();
				composer.addPass(glitchPass);
				const filmPass = new FilmPass(1);
				composer.addPass(filmPass);
				composer.addPass(outputPass);
				camera.lookAt(0, 0, 0);
				const light = new THREE.PointLight(0xffffff, 100);
				light.position.set(0, 0, 5);
				scene.add(light);
				renderer.setSize(container.offsetWidth - 50, container.offsetHeight - 50);
				composer.setSize(container.offsetWidth - 50, container.offsetHeight - 50);
				container.appendChild(renderer.domElement);

				//HUD CAMERA
				const scanlines_texture = new THREE.TextureLoader().load('/media/scanline_overlay.png');
				scanlines_texture.wrapT = THREE.RepeatWrapping;
				const hud_camera = new THREE.OrthographicCamera(-10, 10, 5, -5, 0.1, 100);
				const hud_scene = new THREE.Scene();
				hud_camera.position.z = 5;
				const hud_geometry = new THREE.PlaneGeometry(20, 10);
				const hud_material = new THREE.MeshBasicMaterial({map: scanlines_texture, transparent: true, opacity: 0.5,});
				const hud_mesh = new THREE.Mesh(hud_geometry, hud_material);
				hud_scene.add(hud_mesh);

				// INITIAL STATE
				const paddle_speed = initial_state.paddle_speed;
				const paddle_length = initial_state.paddle_length;
				const paddle_width = initial_state.paddle_width;
				const ball_radius = initial_state.ball_radius;
				const field_length = initial_state.field_length;
				const field_width = initial_state.field_width;
				const paddle_offset = initial_state.paddle_offset;
				const player = initial_state.player;
				const win_score = initial_state.win_score;
				const keys = {};
				const pending_inputs = [];
				camera.position.set(0, 0, 75);

				// MESSAGE SURFACE
				const message_canvas = document.createElement('canvas');
				message_canvas.width = 40 * field_width;
				message_canvas.heigth = 40 * field_length;
				let message_tex = new THREE.CanvasTexture(message_canvas);
				let message_ctx = message_canvas.getContext('2d');
				message_ctx.imageSmoothingEnabled = false;
				message_ctx.fillStyle = 'black';
				message_ctx.fillRect(0, 0, message_canvas.width, message_canvas.height);
				message_ctx.fillStyle = 'yellow';
				message_ctx.font = "20px 'Press Start 2P'";
				message_ctx.textAlign = 'center'
				message_ctx.fillText("WAITING FOR PLAYER ...", message_canvas.width / 2, message_canvas.height / 3, message_canvas.width);
				message_tex.needsUpdate = true;
				const message_plane_material = new THREE.MeshBasicMaterial({
					map: message_tex,
					side: THREE.DoubleSide,
				});
				const message_plane_geometry = new THREE.PlaneGeometry(2 * field_length, 2 * field_width);
				const message_plane = new THREE.Mesh(message_plane_geometry, message_plane_material);
				message_plane.position.set(0, 0, -2 * ball_radius);
				scene.add(message_plane);


				// FIELD
				const material = new THREE.LineBasicMaterial({color: 0x0000ff});
				const points = [];
				points.push(new THREE.Vector3(-field_length, field_width, 0));
				points.push(new THREE.Vector3(0, field_width, 0));
				points.push(new THREE.Vector3(0, -field_width, 0));
				points.push(new THREE.Vector3(0, field_width, 0));
				points.push(new THREE.Vector3(field_length, field_width, 0));
				points.push(new THREE.Vector3(field_length, -field_width, 0));
				points.push(new THREE.Vector3(-field_length, -field_width, 0));
				points.push(new THREE.Vector3(-field_length, field_width, 0));
				const geometry = new THREE.BufferGeometry().setFromPoints(points);
				const line = new THREE.Line(geometry, material);
				scene.add(line);

				// CONTROLS
				const control_canvas = document.createElement('canvas');
				control_canvas.width = 100;
				control_canvas.heigth = 100;
				let control_tex = new THREE.CanvasTexture(control_canvas);
				let control_ctx = control_canvas.getContext('2d');
				control_ctx.imageSmoothingEnabled = false;
				control_ctx.fillStyle = 'black';
				control_ctx.fillRect(0, 0, 100, 200);
				control_ctx.fillStyle = 'yellow';
				control_ctx.font = "60px 'Press Start 2P'";
				control_ctx.textAlign = 'center'
				control_ctx.fillText("↑", 50, 70);
				control_ctx.fillText("↓", 50, 140);
				control_tex.needsUpdate = true;
				const control_plane_material = new THREE.MeshBasicMaterial({
					map: control_tex,
					side: THREE.DoubleSide,
				});
				const control_plane_geometry = new THREE.PlaneGeometry(5, 10);
				const control_plane = new THREE.Mesh(control_plane_geometry, control_plane_material);
				if (player == 1) {
					control_plane.position.set(field_length + 5, 0, -ball_radius);
					scene.add(control_plane);
				}
				if (player == 2) {
					control_plane.position.set(-field_length - 5, 0, -ball_radius);
					scene.add(control_plane);
				}


				// PLAYER ONE
				const p1_score_canvas = document.createElement('canvas')
				p1_score_canvas.width = 100;
				p1_score_canvas.heigth = 100;
				let p1_score_tex = new THREE.CanvasTexture(p1_score_canvas);
				let p1_score_ctx = p1_score_canvas.getContext('2d');
				p1_score_ctx.fillStyle = 'black';
				p1_score_ctx.fillRect(0, 0, 200, 200);
				p1_score_ctx.fillStyle = 'yellow';
				p1_score_ctx.font = "80px 'Press Start 2P'";
				p1_score_ctx.textAlign = 'center'
				p1_score_ctx.fillText(initial_state.p1_score, 50, 100);
				p1_score_tex.needsUpdate = true;
				const p1_score_plane_material = new THREE.MeshBasicMaterial({
					map: p1_score_tex,
					side: THREE.DoubleSide,
				});
				const p1_score_plane_geometry = new THREE.PlaneGeometry(5, 5);
				const p1_score_plane = new THREE.Mesh(p1_score_plane_geometry, p1_score_plane_material);
				p1_score_plane.position.set(5, field_width - 2.5, -ball_radius);
				scene.add(p1_score_plane);

				const p1_material = new THREE.MeshBasicMaterial({color: 0x00aaaa});
				const p1_geometry = new RoundedBoxGeometry(paddle_width, paddle_length, paddle_width, 2, 0.1);
				const p1_obj = new THREE.Mesh(p1_geometry, p1_material);
				p1_obj.position.set(field_length - paddle_offset, 0, 0);
				const p1 = {
					controls: {
						up: "ArrowUp",
						down: "ArrowDown"
					},
					x: field_length - paddle_offset,
					y: 0,
					ySpeed: paddle_speed,
					score: 0,
					input_id: 0,
					next_x: field_length - paddle_offset,
					next_y: 0,
					handleInput(dt) {
						let input = 0;
						if (keys[this.controls.up])
							input += dt;
						if (keys[this.controls.down])
							input -= dt;
						if (input === 0)
							return;
						window.game_online.game_socket.send(JSON.stringify({
							player: player,
							input_id: this.input_id,
							input: input,
						}));
						pending_inputs.push({'input_id': this.input_id, 'input': input});
						this.input_id++;
						this.doMove(input);
					},
					doMove(input) {
						this.y += input * this.ySpeed;
						if (this.y > field_width)
							this.y = field_width;
						if (this.y < -field_width)
							this.y = -field_width;
					}
				};
				scene.add(p1_obj);

				// PLAYER TWO
				const p2_score_canvas = document.createElement('canvas')
				p2_score_canvas.width = 100;
				p2_score_canvas.heigth = 100;
				let p2_score_ctx = p2_score_canvas.getContext('2d');
				let p2_score_tex = new THREE.CanvasTexture(p2_score_canvas);
				p2_score_ctx.fillStyle = 'black';
				p2_score_ctx.fillRect(0, 0, 200, 200);
				p2_score_ctx.fillStyle = 'yellow';
				p2_score_ctx.textAlign = 'center'
				p2_score_ctx.font = "80px 'Press Start 2P'";
				p2_score_ctx.fillText(initial_state.p2_score, 50, 100);
				p2_score_tex.needsUpdate = true;
				const p2_score_plane_material = new THREE.MeshBasicMaterial({
					map: p2_score_tex,
					side: THREE.DoubleSide,
				});
				const p2_score_plane_geometry = new THREE.PlaneGeometry(5, 5);
				const p2_score_plane = new THREE.Mesh(p2_score_plane_geometry, p2_score_plane_material);
				p2_score_plane.position.set(-5, field_width - 2.5, -ball_radius);
				scene.add(p2_score_plane);

				const p2_material = new THREE.MeshBasicMaterial({color: 0xff0000});
				const p2_geometry = new RoundedBoxGeometry(paddle_width, paddle_length, paddle_width, 2, 0.1);
				const p2_obj = new THREE.Mesh(p2_geometry, p2_material);
				p2_obj.position.set(-field_length + paddle_offset, 0, 0);
				const p2 = {
					controls: {
						up: 'ArrowUp',
						down: 'ArrowDown'
					},
					x: -field_length + paddle_offset,
					y: 0,
					dx: 0,
					dy: 0,
					dir: 0,
					ySpeed: paddle_speed,
					score: 0,
					input_id: 0,
					next_x: -field_length + paddle_offset,
					next_y: 0,
					handleInput(dt) {
						let input = 0;
						if (keys[this.controls.up])
							input += dt;
						if (keys[this.controls.down])
							input -= dt;
						if (input === 0)
							return;
						window.game_online.game_socket.send(JSON.stringify({
							player: player,
							input_id: this.input_id,
							input: input,
						}));
						pending_inputs.push({'input_id': this.input_id, 'input': input});
						this.input_id++;
						this.doMove(input);
					},
					doMove(input) {
						this.y += input * this.ySpeed;
						if (this.y > field_width)
							this.y = field_width;
						if (this.y < -field_width)
							this.y = -field_width;
					}
				};
				scene.add(p2_obj);

				// BALL
				const ball_material = new THREE.MeshBasicMaterial({color: 0xffffff});
				const ball_geometry = new RoundedBoxGeometry(2 * ball_radius, 2 * ball_radius, 2 * ball_radius, 2, 0.1);
				const ball_obj = new THREE.Mesh(ball_geometry, ball_material);
				ball_obj.geometry.computeBoundingBox();
				const ball = {
					x: 0,
					y: 0,
					next_x: 0,
					next_y: 0,
				};
				scene.add(ball_obj);

				// KEY AND UPDATE HANDLERS
				function keyEventHandler(event) {
					keys[event.key] = event.type === "keydown";
					keys.firstKeyPressed = true;
				}

				let glitch_time = 0;
				document.addEventListener("keydown", keyEventHandler, false);
				document.addEventListener("keyup", keyEventHandler, false);

				function handleUpdate() {
					let last_input = -1;
					while (true) {
						if (messages_len <= 0)
							break;
						scene.remove(message_plane);
						const update = messages[0];
						messages.splice(0, 1);
						messages_len--;
						if (player === 1) {
							p1.x = update.p1.x;
							p1.y = update.p1.y;
							p2.x = p2.next_x;
							p2.y = p2.next_y;
							p2.next_x = update.p2.x;
							p2.next_y = update.p2.y;
						}
						if (player === 2) {
							p2.x = update.p2.x;
							p2.y = update.p2.y;
							p1.x = p1.next_x;
							p1.y = p1.next_y;
							p1.next_x = update.p1.x;
							p1.next_y = update.p1.y;
						}
						ball.x = ball.next_x;
						ball.y = ball.next_y;
						ball.next_x = update.ball.x;
						ball.next_y = update.ball.y;
						if (player === 1)
							last_input = update.p1.input_id
						if (player === 2)
							last_input = update.p2.input_id
						if (p1.score != update.p1.score) {
							p1.score = update.p1.score;
							p1_score_ctx.fillStyle = 'black';
							p1_score_ctx.fillRect(0, 0, 200, 200);
							p1_score_ctx.fillStyle = 'yellow';
							p1_score_ctx.fillText(p1.score, 50, 100);
							p1_score_tex.needsUpdate = true;
							glitch_time = 0.3;
							glitchPass.curF = 0;
						}
						if (p2.score != update.p2.score) {
							p2.score = update.p2.score;
							p2_score_ctx.fillStyle = 'black';
							p2_score_ctx.fillRect(0, 0, 200, 200);
							p2_score_ctx.fillStyle = 'yellow';
							p2_score_ctx.fillText(p2.score, 50, 100);
							p2_score_tex.needsUpdate = true;
							glitch_time = 0.3;
							glitchPass.curF = 0;
						}
					}
					if (last_input >= 0) {
						while (pending_inputs.length > 0) {
							if (player === 1) {
								if (pending_inputs[0].input_id > last_input)
									p1.doMove(pending_inputs[0].input);
								pending_inputs.splice(0, 1);
							}
							if (player === 2) {
								if (pending_inputs[0].input_id > last_input)
									p2.doMove(pending_inputs[0].input);
								pending_inputs.splice(0, 1);
							}
						}
					}
				}

				const clock = new THREE.Clock();
				clock.start();
				let delta_time = 0;
				let cumul_time = 0;
				const fps = initial_state.client_fps;
				const refresh_time = 1 / fps;

				// ANIMATION LOOP
				function animate() {
					window.game_online.animation_frame = requestAnimationFrame(animate);
					let ratio;
					let now;
					delta_time = clock.getDelta();
					cumul_time += delta_time;
					if (glitch_time > 0)
						glitch_time -= delta_time;
					else
						glitchPass.curF = 100;
					if (p2.score >= win_score || p1.score >= win_score) {
						game_over = true;
						scene.remove(ball_obj);
						message_ctx.fillStyle = 'black';
						message_ctx.fillRect(0, 0, message_canvas.width, message_canvas.height);
						message_ctx.fillStyle = 'yellow';
						message_ctx.font = "20px 'Press Start 2P'";
						message_ctx.textAlign = 'center'
						message_ctx.fillText("GAME OVER", message_canvas.width / 2, message_canvas.height / 3, message_canvas.width);
						message_tex.needsUpdate = true;
						scene.add(message_plane);
					}
					if (!game_over)
						if (cumul_time > 2 * refresh_time)
							cumul_time = 2 * refresh_time;
					if (cumul_time > refresh_time) {
						if (!game_over) {
							if (player === 1)
								p1.handleInput(cumul_time);
							if (player === 2)
								p2.handleInput(cumul_time);
							handleUpdate();
							if (player === 1) {
								now = new Date();
								ratio = (now - server_last_update) / server_dt;
								p1_obj.position.set(p1.x, p1.y, 0);
								p2_obj.position.set((1 - ratio) * p2.x + ratio * p2.next_x, (1 - ratio) * p2.y + ratio * p2.next_y, 0);
							}
							if (player === 2) {
								now = new Date();
								ratio = (now - server_last_update) / server_dt;
								p2_obj.position.set(p2.x, p2.y, 0);
								p1_obj.position.set((1 - ratio) * p1.x + ratio * p1.next_x, (1 - ratio) * p1.y + ratio * p1.next_y, 0);
							}
							ball_obj.position.set((1 - ratio) * ball.x + ratio * ball.next_x, (1 - ratio) * ball.y + ratio * ball.next_y, 0);
						}
						cumul_time -= refresh_time;
						renderer.autoClear = true;
						composer.render();
						renderer.autoClear = false;
						renderer.clearDepth();
						renderer.render(hud_scene, hud_camera);
					}
				}
				animate();
			} else {
				const warning = WebGL.getWebGLErrorMessage();
				document.body.appendChild(warning);
			}
		})
	},
	start() {
		game_over = false;
		this.game_socket = new WebSocket(wsScheme + '://' + window.location.host + '/ws/game/' + window.location.hash.split('?')[1] + '/');
		this.game_socket.onmessage = function (e) {
			const data = JSON.parse(e.data);
			if (data.type === "init") {
				initial_state = data;
				console.log(initial_state.player);
				window.game_online.game();
			}
			if (data.type === "update") {
				const now = new Date();
				server_dt = now - server_last_update;
				server_last_update = now;
				messages_len++;
				messages.push(data);
			}
		}
	},
}
