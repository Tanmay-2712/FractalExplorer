class FractalExplorer {
        constructor() {
            this.canvas = document.getElementById('fractalCanvas');
            this.gl = this.canvas.getContext('webgl2', {
                preserveDrawingBuffer: true,
                antialias: true
            });
            
            if (!this.gl) {
                alert('WebGL 2 not supported');
                return;
            }

            // Initialize with default parameters
            this.params = {
                maxIterations: 1000,
                zoom: 250,         // Adjusted default zoom
                offsetX: -0.5,     // Adjusted default position
                offsetY: 0,
                colorScheme: 0,
                fractalType: 'mandelbrot',
                colorCycles: 1.0,
                colorOffset: 0.0,
                brightness: 1.0,
                contrast: 1.0,
                escapeRadius: 2.0,
                smoothing: 1.0,
                juliaReal: -0.4,
                juliaImag: 0.6,
                mandelbrotPower: 2.0,
                shipRotation: 1.0,
                foldIntensity: 1.0
            };

            this.initWebGL();
            this.resizeCanvas();
            this.setupEventListeners();
            this.setupControls();
            this.render();
        }

        initWebGL() {
            // Vertex shader remains the same
            const vertexShader = `#version 300 es
                in vec4 position;
                void main() {
                    gl_Position = position;
                }`;

            // Updated fragment shader
            const fragmentShader = `#version 300 es
                precision highp float;
                uniform vec2 resolution;
                uniform vec2 offset;
                uniform float zoom;
                uniform int maxIterations;
                uniform int fractalType;
                uniform float params[12];
                out vec4 fragColor;

                vec3 hsv2rgb(vec3 c) {
                    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
                    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
                    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
                }

                vec3 getColor(float t) {
                    t = fract(t * params[0] + params[11]); // colorCycles and offset
                    
                    vec3 color;
                    int scheme = int(params[8]);
                    
                    switch(scheme) {
                        case 0: // Rainbow
                            color = hsv2rgb(vec3(t, 0.85, 1.0));
                            break;
                        case 1: // Fire
                            color = vec3(
                                min(1.0, t * 2.0),
                                pow(t, 2.0) * 0.8,
                                pow(t, 4.0) * 0.3
                            );
                            break;
                        case 2: // Ocean
                            color = vec3(
                                pow(t, 3.0) * 0.3,
                                pow(t, 2.0) * 0.5,
                                min(1.0, t * 1.5)
                            );
                            break;
                        case 3: // Psychedelic
                            color = hsv2rgb(vec3(t * 3.0, 0.95, 1.0));
                            break;
                        case 4: // Red
                            color = vec3(t, 0.0, 0.0);
                            break;
                        case 5: // Green
                            color = vec3(0.0, t, 0.0);
                            break;
                        case 6: // Blue
                            color = vec3(0.0, 0.0, t);
                            break;
                        case 7: // Purple
                            color = vec3(t * 0.8, 0.0, t);
                            break;
                        default:
                            color = vec3(t); // Fallback to grayscale
                    }
                    
                    // Apply contrast and brightness
                    color = (color - 0.5) * params[2] + 0.5; // contrast
                    color *= params[3]; // brightness
                    
                    return clamp(color, 0.0, 1.0);
                }

                void main() {
                    vec2 uv = (gl_FragCoord.xy - resolution * 0.5) / zoom;
                    vec2 c = uv + offset;
                    vec2 z;
                    
                    if(fractalType == 1) { // Julia set
                        z = c;  // For Julia set, initial z is the point we're rendering
                        c = vec2(params[4], params[5]);  // And c is the fixed Julia parameter
                    } else {
                        z = vec2(0.0, 0.0);  // For other fractals, z starts at origin
                    }

                    int iter;
                    float smoothIter = 0.0;
                    
                    for(iter = 0; iter < maxIterations; iter++) {
                        if(fractalType == 0) { // Mandelbrot
                            float power = params[6];
                            float r = sqrt(z.x * z.x + z.y * z.y);
                            float theta = atan(z.y, z.x);
                            r = pow(r, power);
                            theta = theta * power;
                            z.x = r * cos(theta);
                            z.y = r * sin(theta);
                            z += c;
                            
                        } else if(fractalType == 1) { // Julia
                            // Correct Julia set formula
                            float x = z.x * z.x - z.y * z.y;
                            float y = 2.0 * z.x * z.y;
                            z = vec2(x + c.x, y + c.y);  // z² + c
                            
                        } else if(fractalType == 2) { // Tricorn
                            float x = z.x * z.x - z.y * z.y;
                            float y = -2.0 * z.x * z.y;
                            z = vec2(x, y) + c;
                            
                        } else if(fractalType == 3) { // Burning Ship
                            z.x = abs(z.x);
                            z.y = abs(z.y);
                            float x = z.x * z.x - z.y * z.y;
                            float y = 2.0 * z.x * z.y;
                            z = vec2(x, -y) * params[7] + c;
                            
                        } else if(fractalType == 4) { // Celtic
                            float x = abs(z.x * z.x - z.y * z.y);
                            float y = 2.0 * z.x * z.y;
                            z = vec2(x, y) * params[10] + c;
                        }

                        float mag2 = dot(z, z);
                        if(mag2 > params[9] * params[9]) {
                            smoothIter = float(iter) + 1.0 - log2(log2(mag2));
                            break;
                        }
                    }

                    float t;
                    if(iter >= maxIterations) {
                        t = 0.0;
                    } else {
                        t = mix(float(iter), smoothIter, params[1]);
                        t = t / float(maxIterations);
                    }

                    vec3 color = getColor(t);
                    fragColor = vec4(color, 1.0);
                }`;

            // Create and compile shaders
            const vs = this.createShader(this.gl.VERTEX_SHADER, vertexShader);
            const fs = this.createShader(this.gl.FRAGMENT_SHADER, fragmentShader);
            
            // Create program
            this.program = this.gl.createProgram();
            this.gl.attachShader(this.program, vs);
            this.gl.attachShader(this.program, fs);
            this.gl.linkProgram(this.program);

            // Setup a full-screen quad
            const positions = new Float32Array([
                -1, -1,
                 1, -1,
                -1,  1,
                 1,  1
            ]);

            const buffer = this.gl.createBuffer();
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
            this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);

            // Setup attributes and uniforms
            const positionLocation = this.gl.getAttribLocation(this.program, 'position');
            this.gl.enableVertexAttribArray(positionLocation);
            this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);

            // Store uniform locations
            this.uniformLocations = {
                resolution: this.gl.getUniformLocation(this.program, 'resolution'),
                offset: this.gl.getUniformLocation(this.program, 'offset'),
                zoom: this.gl.getUniformLocation(this.program, 'zoom'),
                maxIterations: this.gl.getUniformLocation(this.program, 'maxIterations'),
                fractalType: this.gl.getUniformLocation(this.program, 'fractalType'),
                params: this.gl.getUniformLocation(this.program, 'params')
            };
        }

        createShader(type, source) {
            const shader = this.gl.createShader(type);
            this.gl.shaderSource(shader, source);
            this.gl.compileShader(shader);
            if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
                console.error(this.gl.getShaderInfoLog(shader));
                this.gl.deleteShader(shader);
                return null;
            }
            return shader;
        }

        render() {
            const gl = this.gl;
            gl.viewport(0, 0, this.canvas.width, this.canvas.height);
            gl.useProgram(this.program);

            // Create params array with all necessary values
            const params = new Float32Array([
                this.params.colorCycles,      // [0]
                this.params.smoothing,        // [1]
                this.params.contrast,         // [2]
                this.params.brightness,       // [3]
                this.params.juliaReal,        // [4]
                this.params.juliaImag,        // [5]
                this.params.mandelbrotPower,  // [6]
                this.params.shipRotation,     // [7]
                this.params.colorScheme,      // [8]
                this.params.escapeRadius,     // [9]
                this.params.foldIntensity,    // [10]
                this.params.colorOffset       // [11]
            ]);

            // Update uniforms
            gl.uniform2f(this.uniformLocations.resolution, this.canvas.width, this.canvas.height);
            gl.uniform2f(this.uniformLocations.offset, this.params.offsetX, this.params.offsetY);
            gl.uniform1f(this.uniformLocations.zoom, this.params.zoom);
            gl.uniform1i(this.uniformLocations.maxIterations, this.params.maxIterations);
            gl.uniform1i(this.uniformLocations.fractalType, 
                ['mandelbrot', 'julia', 'tricorn', 'burning-ship', 'celtic']
                .indexOf(this.params.fractalType));
            gl.uniform1fv(this.uniformLocations.params, params);

            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }

        setupEventListeners() {
            let zoomInterval = null;
            let currentX = 0;
            let currentY = 0;
            
            this.canvas.addEventListener('mousemove', (e) => {
                currentX = e.clientX;
                currentY = e.clientY;
                
                if (this.isDragging) {
                    const dx = e.clientX - this.lastX;
                    const dy = e.clientY - this.lastY;
                    const panSpeed = 1.0 / this.params.zoom;
                    this.params.offsetX -= dx * panSpeed * 2;
                    this.params.offsetY += dy * panSpeed * 2;
                    this.lastX = e.clientX;
                    this.lastY = e.clientY;
                    this.render();
                }
            });

            this.canvas.addEventListener('mousedown', (e) => {
                if (e.button === 0) { // Left click for pan
                    this.isDragging = true;
                    this.lastX = e.clientX;
                    this.lastY = e.clientY;
                } else if (e.button === 2) { // Right click for continuous zoom
                    e.preventDefault();
                    const zoomSpeed = 0.02; // Adjust for faster/slower zoom
                    
                    const doZoom = () => {
                        // Use current mouse position for each zoom step
                        const factor = e.shiftKey ? (1 - zoomSpeed) : (1 + zoomSpeed);
                        this.zoomAtPoint(currentX, currentY, factor);
                        zoomInterval = requestAnimationFrame(doZoom);
                    };
                    doZoom();
                }
            });

            document.addEventListener('mouseup', () => {
                this.isDragging = false;
                if (zoomInterval) {
                    cancelAnimationFrame(zoomInterval);
                    zoomInterval = null;
                }
            });

            // Prevent context menu
            this.canvas.addEventListener('contextmenu', (e) => {
                e.preventDefault();
            });

            // Mouse wheel zoom
            this.canvas.addEventListener('wheel', (e) => {
                e.preventDefault();
                const factor = e.deltaY > 0 ? 0.95 : 1.05;
                this.zoomAtPoint(e.clientX, e.clientY, factor);
            });

            // Handle window resize
            window.addEventListener('resize', () => {
                this.resizeCanvas();
                this.render();
            });
        }

        zoomAtPoint(x, y, factor) {
            const rect = this.canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            
            // Convert screen coordinates to canvas coordinates
            const canvasX = (x - rect.left) * dpr;
            const canvasY = (y - rect.top) * dpr;
            
            // Convert to normalized device coordinates (-1 to 1)
            const ndcX = (canvasX / this.canvas.width) * 2 - 1;
            const ndcY = 1 - (canvasY / this.canvas.height) * 2; // Invert Y coordinate
            
            // Convert to fractal coordinates
            const fractalX = (ndcX * this.canvas.width / this.params.zoom) + this.params.offsetX;
            const fractalY = (ndcY * this.canvas.height / this.params.zoom) + this.params.offsetY;
            
            // Update zoom
            this.params.zoom *= factor;
            
            // Calculate new offsets to maintain the zoom point
            this.params.offsetX = fractalX - (ndcX * this.canvas.width / this.params.zoom);
            this.params.offsetY = fractalY - (ndcY * this.canvas.height / this.params.zoom);
            
            // Update coordinates display
            const coordsElement = document.querySelector('.coordinates');
            if (coordsElement) {
                coordsElement.textContent = 
                    `x: ${fractalX.toFixed(6)} y: ${fractalY.toFixed(6)} zoom: ${this.params.zoom.toFixed(1)}x`;
            }
            
            this.render();
        }

        setupControls() {
            // Update control handling
            const updateParameter = (id, value) => {
                this.params[id] = parseFloat(value);
                const rangeValue = document.querySelector(`label[for="${id}"] .range-value`);
                if (rangeValue) {
                    rangeValue.textContent = parseFloat(value).toFixed(2);
                }
                this.render();
            };

            // Set up all range inputs
            document.querySelectorAll('input[type="range"]').forEach(input => {
                // Set initial values
                input.value = this.params[input.id];
                updateParameter(input.id, input.value);

                // Add event listener
                input.addEventListener('input', (e) => {
                    updateParameter(e.target.id, e.target.value);
                });
            });

            // Set up color scheme buttons
            document.querySelectorAll('.color-preset').forEach(preset => {
                preset.addEventListener('click', (e) => {
                    document.querySelectorAll('.color-preset').forEach(p => 
                        p.classList.remove('active'));
                    preset.classList.add('active');
                    this.params.colorScheme = parseInt(preset.dataset.scheme);
                    this.render();
                });
            });

            // Handle custom color picker
            const customColorPicker = document.getElementById('customColorPicker');
            if (customColorPicker) {
                customColorPicker.addEventListener('input', (e) => {
                    this.params.customColor = e.target.value;
                    this.render();
                });
            }

            // Add fractal type button listeners
            document.querySelectorAll('[data-type]').forEach(button => {
                button.addEventListener('click', (e) => {
                    this.switchFractalType(e.target.dataset.type);
                });
            });
        }

        // Add this method for fractal type switching
        switchFractalType(type) {
            // Remove active class from all buttons
            document.querySelectorAll('[data-type]').forEach(btn => 
                btn.classList.remove('active'));
            // Add active class to selected button
            document.querySelector(`[data-type="${type}"]`).classList.add('active');

            this.params.fractalType = type;
            
            // Hide all type-specific controls
            document.querySelectorAll('.type-specific').forEach(el => {
                el.style.display = 'none';
            });
            
            // Show relevant controls and set default values
            switch(type) {
                case 'mandelbrot':
                    document.querySelectorAll('.mandelbrot-params').forEach(el => {
                        el.style.display = 'block';
                    });
                    this.params.offsetX = -0.5;
                    this.params.offsetY = 0;
                    this.params.zoom = 250;
                    this.params.mandelbrotPower = 2.0;
                    break;
                case 'julia':
                    document.querySelectorAll('.julia-params').forEach(el => {
                        el.style.display = 'block';
                    });
                    this.params.offsetX = 0;
                    this.params.offsetY = 0;
                    this.params.zoom = 250;
                    this.params.juliaReal = -0.4;
                    this.params.juliaImag = 0.6;
                    break;
                case 'tricorn':
                    this.params.offsetX = 0;
                    this.params.offsetY = 0;
                    this.params.zoom = 250;
                    break;
                case 'burning-ship':
                    document.querySelectorAll('.burning-ship-params').forEach(el => {
                        el.style.display = 'block';
                    });
                    this.params.offsetX = -0.5;
                    this.params.offsetY = -0.25;
                    this.params.zoom = 250;
                    this.params.shipRotation = 1.0;
                    break;
                case 'celtic':
                    document.querySelectorAll('.celtic-params').forEach(el => {
                        el.style.display = 'block';
                    });
                    this.params.offsetX = -0.5;
                    this.params.offsetY = 0;
                    this.params.zoom = 250;
                    this.params.foldIntensity = 1.0;
                    break;
            }
            
            this.render();
        }

        // Add reset method
        reset() {
            this.params = {
                ...this.params,
                zoom: 250,
                offsetX: -0.5,
                offsetY: 0,
                colorCycles: 1.0,
                colorOffset: 0,
                brightness: 1.0,
                contrast: 1.0,
                smoothing: 1.0
            };
            this.render();
        }

        resizeCanvas() {
            const dpr = window.devicePixelRatio || 1;
            const displayWidth = Math.floor(this.canvas.clientWidth * dpr);
            const displayHeight = Math.floor(this.canvas.clientHeight * dpr);

            // Only resize if necessary
            if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
                this.canvas.width = displayWidth;
                this.canvas.height = displayHeight;
            }
        }

        getColorSchemeIndex() {
            const schemes = {
                'rainbow': 0,
                'fire': 1,
                'ocean': 2,
                'psychedelic': 3,
                'red': 4,
                'green': 5,
                'blue': 6,
                'purple': 7,
                'custom': 8
            };
            return schemes[this.params.colorScheme] || 0;
        }
    }