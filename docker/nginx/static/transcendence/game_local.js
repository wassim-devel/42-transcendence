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


const font = new FontFaceObserver('Press Start 2P');
window.game_local = {
	animation_frame: 0,
	stop() {
		if (this.animation_frame != 0)
			cancelAnimationFrame(this.animation_frame);
	},
	start() {
		font.load().then(() => {
			if (WebGL.isWebGLAvailable()) {
				const container = document.getElementById("pongCanvasLocal");
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
				const ball_base_speed = 15;
				const ball_speed_inc = 2;
				const ball_max_speed = 60;
				const paddle_speed = 15;
				const effect_strength = 0;
				const max_bounce_angle = Math.PI / 2;
				const paddle_length = 4;
				const paddle_radius = 0.5;
				const ball_radius = 0.5;
				const field_length = 30;
				const field_width = 20;
				const paddle_offset = 2;
				const ai_reaction_time = 1;
				const ball_start_angle = Math.random() * max_bounce_angle - max_bounce_angle / 2;
				camera.position.set(0, 0, 75);

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

				// PLAYER ONE
				const p1_control_canvas = document.createElement('canvas');
				p1_control_canvas.width = 100;
				p1_control_canvas.heigth = 100;
				let p1_control_tex = new THREE.CanvasTexture(p1_control_canvas);
				let p1_control_ctx = p1_control_canvas.getContext('2d');
				p1_control_ctx.imageSmoothingEnabled = false;
				p1_control_ctx.fillStyle = 'black';
				p1_control_ctx.fillRect(0, 0, 100, 200);
				p1_control_ctx.fillStyle = 'yellow';
				p1_control_ctx.font = "60px 'Press Start 2P'";
				p1_control_ctx.textAlign = 'center'
				p1_control_ctx.fillText("↑", 50, 70);
				p1_control_ctx.fillText("↓", 50, 140);
				p1_control_tex.needsUpdate = true;
				const p1_control_plane_material = new THREE.MeshBasicMaterial({
					map: p1_control_tex,
					side: THREE.DoubleSide,
				});
				const p1_control_plane_geometry = new THREE.PlaneGeometry(5, 10);
				const p1_control_plane = new THREE.Mesh(p1_control_plane_geometry, p1_control_plane_material);
				p1_control_plane.position.set(field_length + 5, 0, -ball_radius);
				scene.add(p1_control_plane);

				const p1_score_canvas = document.createElement('canvas');
				p1_score_canvas.width = 100;
				p1_score_canvas.heigth = 100;
				let p1_score_tex = new THREE.CanvasTexture(p1_score_canvas);
				let p1_score_ctx = p1_score_canvas.getContext('2d');
				p1_score_ctx.imageSmoothingEnabled = false;
				p1_score_ctx.fillStyle = 'black';
				p1_score_ctx.fillRect(0, 0, 200, 200);
				p1_score_ctx.fillStyle = 'yellow';
				p1_score_ctx.font = "80px 'Press Start 2P'";
				p1_score_ctx.textAlign = 'center'
				p1_score_ctx.fillText(0, 50, 100);
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
				const p1_geometry = new RoundedBoxGeometry(2 * paddle_radius, paddle_length, 2 * paddle_radius, 2, 0.1);
				const p1_obj = new THREE.Mesh(p1_geometry, p1_material);
				const p1_box = new THREE.Box3();
				p1_obj.geometry.computeBoundingBox();
				const p1 = {
					controls: {
						up: "ArrowUp",
						down: "ArrowDown"
					},
					x: field_length - paddle_offset,
					y: 0,
					dx: 0,
					dy: 0,
					dir: 0,
					ySpeed: paddle_speed,
					score: 0,
					doMove() {
						const k = this.controls;
						this.dy = 0;
						this.dx = 0;
						if (keys[k.up]) {
							this.dy += this.ySpeed;
							this.dir = Math.PI * 1.5;
						}
						if (keys[k.down]) {
							this.dy += -this.ySpeed;
							this.dir = Math.PI * 0.5;
						}
						this.y = this.y + cumul_time * this.dy;
						if (this.y > field_width)
							this.y = field_width;
						if (this.y < -field_width)
							this.y = -field_width;
						p1_obj.position.set(this.x, this.y, 0);
					}
				};
				scene.add(p1_obj);

				// PLAYER TWO
				const p2_control_canvas = document.createElement('canvas');
				p2_control_canvas.width = 100;
				p2_control_canvas.heigth = 100;
				let p2_control_tex = new THREE.CanvasTexture(p2_control_canvas);
				let p2_control_ctx = p2_control_canvas.getContext('2d');
				p2_control_ctx.imageSmoothingEnabled = false;
				p2_control_ctx.fillStyle = 'black';
				p2_control_ctx.fillRect(0, 0, 100, 200);
				p2_control_ctx.fillStyle = 'yellow';
				p2_control_ctx.font = "60px 'Press Start 2P'";
				p2_control_ctx.textAlign = 'center'
				p2_control_ctx.fillText("W", 50, 70);
				p2_control_ctx.fillText("S", 50, 140);
				p2_control_tex.needsUpdate = true;
				const p2_control_plane_material = new THREE.MeshBasicMaterial({
					map: p2_control_tex,
					side: THREE.DoubleSide,
				});
				const p2_control_plane_geometry = new THREE.PlaneGeometry(5, 10);
				const p2_control_plane = new THREE.Mesh(p2_control_plane_geometry, p2_control_plane_material);
				p2_control_plane.position.set(-field_length - 5, 0, -ball_radius);
				scene.add(p2_control_plane);

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
				p2_score_ctx.fillText(0, 50, 100);
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
				const p2_geometry = new RoundedBoxGeometry(2 * paddle_radius, paddle_length, 2 * paddle_radius, 2, 0.1);
				const p2_obj = new THREE.Mesh(p2_geometry, p2_material);
				const p2_box = new THREE.Box3();
				p2_obj.geometry.computeBoundingBox();
				const p2 = {
					controls: {
						up: 'w',
						down: 's'
					},
					x: -field_length + paddle_offset,
					y: 0,
					dx: 0,
					dy: 0,
					dir: 0,
					ySpeed: paddle_speed,
					score: 0,
					doMove() {
						const k = this.controls;
						this.dy = 0;
						this.dx = 0;
						if (keys[k.up]) {
							this.dy += this.ySpeed;
							this.dir = Math.PI * 1.5;
						}
						if (keys[k.down]) {
							this.dy += -this.ySpeed;
							this.dir = Math.PI * 0.5;
						}
						this.y = this.y + cumul_time * this.dy;
						if (this.y > field_width)
							this.y = field_width;
						if (this.y < -field_width)
							this.y = -field_width;
						p2_obj.position.set(this.x, this.y, 0);
					}
				};
				scene.add(p2_obj);

				// BALL
				const ball_material = new THREE.MeshBasicMaterial({color: 0xffffff});
				const ball_geometry = new RoundedBoxGeometry(2 * ball_radius, 2 * ball_radius, 2 * ball_radius, 2, 0.1);
				const ball_obj = new THREE.Mesh(ball_geometry, ball_material);
				const ball_box = new THREE.Box3();
				ball_obj.geometry.computeBoundingBox();
				const ball = {
					x: 0,
					y: 0,
					dx: Math.cos(ball_start_angle),
					dy: Math.sin(ball_start_angle),
					ddy: 0,
					dir: 0,
					speed: ball_base_speed,
					cooldown: 1,
					glitch_time: 0,
					doMove() {
						let bounce_angle;
						let inter_pos;
						if (this.glitch_time > 0) {
							this.glitch_time -= cumul_time;
						} else {
							glitchPass.curF = 100;
						}
						if (this.cooldown > 0) {
							this.cooldown -= cumul_time;
							return;
						}
						this.dy += effect_strength * cumul_time * this.ddy;
						this.x += cumul_time * this.speed * this.dx;
						this.y += cumul_time * this.speed * this.dy;
						if (ball_box.intersectsBox(p1_box) && this.dx > 0) {
							inter_pos = (this.y - p1.y) / (paddle_length + ball_radius);
							bounce_angle = inter_pos * max_bounce_angle;
							this.dx = -Math.cos(bounce_angle);
							this.dy = Math.sin(bounce_angle);
							this.ddy = -p1.dy;
							this.speed = Math.min(ball_max_speed, this.speed + ball_speed_inc);
						}
						if (ball_box.intersectsBox(p2_box) && this.dx < 0) {
							inter_pos = (this.y - p2.y) / (paddle_length + ball_radius);
							bounce_angle = inter_pos * max_bounce_angle;
							this.dx = Math.cos(bounce_angle);
							this.dy = Math.sin(bounce_angle);
							this.ddy = -p2.dy;
							this.speed = Math.min(ball_max_speed, this.speed + ball_speed_inc);
						}
						if (this.x > field_length) {
							this.x = 0;
							this.y = 0;
							this.speed = ball_base_speed;
							p2.score++;
							if (p2.score >= 10)
							{
								p2.score = 0;
								p1.score = 0;
								p1_score_ctx.fillStyle = 'black';
								p1_score_ctx.fillRect(0, 0, 200, 200);
								p1_score_ctx.fillStyle = 'yellow';
								p1_score_ctx.fillText(p1.score, 50, 100);
								p1_score_tex.needsUpdate = true;
							}
							p2_score_ctx.fillStyle = 'black';
							p2_score_ctx.fillRect(0, 0, 200, 200);
							p2_score_ctx.fillStyle = 'yellow';
							p2_score_ctx.fillText(p2.score, 50, 100);
							p2_score_tex.needsUpdate = true;
							this.ddy = 0;
							this.cooldown = 1;
							this.glitch_time = 0.3;
							glitchPass.curF = 0;
						}
						if (this.x < -field_length) {
							this.x = 0;
							this.y = 0;
							this.speed = ball_base_speed;
							p1.score++;
							if (p1.score >= 10)
							{
								p2.score = 0;
								p1.score = 0;
								p2_score_ctx.fillStyle = 'black';
								p2_score_ctx.fillRect(0, 0, 200, 200);
								p2_score_ctx.fillStyle = 'yellow';
								p2_score_ctx.fillText(p2.score, 50, 100);
								p2_score_tex.needsUpdate = true;
							}
							p1_score_ctx.fillStyle = 'black';
							p1_score_ctx.fillRect(0, 0, 200, 200);
							p1_score_ctx.fillStyle = 'yellow';
							p1_score_ctx.fillText(p1.score, 50, 100);
							p1_score_tex.needsUpdate = true;
							this.ddy = 0;
							this.cooldown = 1;
							this.glitch_time = 0.3;
							glitchPass.curF = 0;
						}
						if ((this.y > field_width && this.dy > 0) || (this.y < -field_width && this.dy < 0)) {
							this.dy = -this.dy;
							// this.dx *= 1 + 10 * Math.abs(this.ddy * this.dy);
							// this.ddy = this.ddy * 0.2;
						}
						ball_obj.position.set(this.x, this.y, 0);
					}
				};
				scene.add(ball_obj);

				// HANDLERS
				const keys = {};

				function keyEventHandler(event) {
					if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
						return;
					}
					if (event.key === p1.controls.up || event.key === p1.controls.down)
						p1_ai.enabled = false;
					if (event.key === p2.controls.up || event.key === p2.controls.down)
						p2_ai.enabled = false;
					if (event.key === ' ') {
						p1_ai.enabled = true;
						p2_ai.enabled = true;
					}
					keys[event.key] = event.type === "keydown";
					keys.firstKeyPressed = true;
					event.preventDefault();
				}

				document.addEventListener("keydown", keyEventHandler, false);
				document.addEventListener("keyup", keyEventHandler, false);
				const clock = new THREE.Clock();
				clock.start();
				let last_ball_x = 0;
				let last_ball_dx = 0;
				let last_ball_y = 0;
				let last_ball_dy = 0;
				let delta_time = 0;
				let cumul_time = 0;
				let ai_cumul_time = 0;
				const fps = 60;
				const refresh_time = 1 / fps;
				let p1_y = 0;
				let p2_y = 0;

				// PLAYER ONE AI
				const p1_ai = {
					enabled: true,
					target: 0,
					last_known_ball_dx: 0,
					last_known_ball_dy: 0,
					paddle_dir: 0,
					last_known_ball_x: 0,
					last_known_ball_y: 0,
					last_known_paddle_pos: 0,
					bounced: true,
					bias: 0,
					doMove() {
						if (!this.enabled)
							return;
						if (this.last_known_ball_x !== last_ball_x || this.last_known_ball_y !== last_ball_y) {
							this.last_known_paddle_pos = p1_y;
							this.last_known_ball_x = last_ball_x;
							this.last_known_ball_y = last_ball_y;
							this.last_known_ball_dx = last_ball_dx;
							this.last_known_ball_dy = last_ball_dy;
							if (this.last_known_ball_dx >= 0) {
								this.bounced = false;
								this.target = this.last_known_ball_y + (field_length - paddle_offset - this.last_known_ball_x) * this.last_known_ball_dy / this.last_known_ball_dx;
								while (this.target > field_width || this.target < -field_width) {
									if (this.target > field_width)
										this.target = 2 * field_width - this.target;
									if (this.target < -field_width)
										this.target = -2 * field_width - this.target;
								}
							} else {
								this.bias = (Math.random() - 0.5) * paddle_length;
								this.bounced = true;
								this.target = 0;
							}
						}
						this.last_known_paddle_pos += this.paddle_dir * paddle_speed * cumul_time;
						if (this.last_known_paddle_pos > field_width)
							this.last_known_paddle_pos = field_width;
						if (this.last_known_paddle_pos < -field_width)
							this.last_known_paddle_pos = -field_width;
						if (this.target + this.bias - this.last_known_paddle_pos > 0.2) {
							keys[p1.controls.up] = true;
							keys[p1.controls.down] = false;
							this.paddle_dir = 1;
						} else if (this.target + this.bias - this.last_known_paddle_pos < -0.2) {
							keys[p1.controls.up] = false;
							keys[p1.controls.down] = true;
							this.paddle_dir = -1;
						} else {
							keys[p1.controls.up] = false;
							keys[p1.controls.down] = false;
							this.paddle_dir = 0;
						}
					}
				}

				// PLAYER TWO AI
				const p2_ai = {
					enabled: true,
					target: 0,
					last_known_ball_dx: 0,
					last_known_ball_dy: 0,
					paddle_dir: 0,
					last_known_ball_x: 0,
					last_known_ball_y: 0,
					last_known_paddle_pos: 0,
					bias: 0,
					doMove() {
						if (!this.enabled)
							return;
						if (this.last_known_ball_x !== last_ball_x || this.last_known_ball_y !== last_ball_y) {
							this.bias = (Math.random() - 0.5) * paddle_length;
							this.last_known_paddle_pos = p2_y;
							this.last_known_ball_x = last_ball_x;
							this.last_known_ball_y = last_ball_y;
							this.last_known_ball_dx = last_ball_dx;
							this.last_known_ball_dy = last_ball_dy;
							if (this.last_known_ball_dx <= 0) {
								this.target = this.last_known_ball_y - (this.last_known_ball_x - (-field_length + paddle_offset)) * this.last_known_ball_dy / this.last_known_ball_dx;
								while (this.target > field_width || this.target < -field_width) {
									if (this.target > field_width)
										this.target = 2 * field_width - this.target;
									if (this.target < -field_width)
										this.target = -2 * field_width - this.target;
								}
							} else {
								this.bias = (Math.random() - 0.5) * paddle_length;
								this.bounced = true;
								this.target = 0;
							}
						}
						this.last_known_paddle_pos += this.paddle_dir * paddle_speed * cumul_time;
						if (this.last_known_paddle_pos > field_width)
							this.last_known_paddle_pos = field_width;
						if (this.last_known_paddle_pos < -field_width)
							this.last_known_paddle_pos = -field_width;
						if (this.target + this.bias - this.last_known_paddle_pos > 0.2) {
							keys[p2.controls.up] = true;
							keys[p2.controls.down] = false;
							this.paddle_dir = 1;
						} else if (this.target + this.bias - this.last_known_paddle_pos < -0.2) {
							keys[p2.controls.up] = false;
							keys[p2.controls.down] = true;
							this.paddle_dir = -1;
						} else {
							keys[p2.controls.up] = false;
							keys[p2.controls.down] = false;
							this.paddle_dir = 0;
						}
					}
				}

				// ANIMATION LOOP
				function animate() {
					window.game_local.animation_frame = requestAnimationFrame(animate);
					delta_time = clock.getDelta();
					cumul_time += delta_time;
					ai_cumul_time += delta_time;
					if (cumul_time > 2 * refresh_time)
						cumul_time = 2 * refresh_time;
					if (ai_cumul_time >= 2 * ai_reaction_time)
						ai_cumul_time = ai_reaction_time;
					if (ai_cumul_time >= ai_reaction_time) {
						p1_y = p1.y;
						p2_y = p2.y;
						last_ball_x = ball.x;
						last_ball_dx = ball.dx;
						last_ball_y = ball.y;
						last_ball_dy = ball.dy;
						ai_cumul_time -= ai_reaction_time;
					}
					if (cumul_time >= refresh_time) {
						p1_box.copy(p1_obj.geometry.boundingBox).applyMatrix4(p1_obj.matrixWorld);
						p2_box.copy(p2_obj.geometry.boundingBox).applyMatrix4(p2_obj.matrixWorld);
						ball_box.copy(ball_obj.geometry.boundingBox).applyMatrix4(ball_obj.matrixWorld);
						p1.doMove();
						p2.doMove();
						ball.doMove();
						p1_ai.doMove();
						p2_ai.doMove();
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
	}
}
