// scene/demo-specific variables go here
var sceneIsDynamic = true;
var earthRadius = 6360;
var atmosphereRadius = 6420;
var altitude = 2000.0;
var camFlightSpeed = 300;
var sunAngle = 5.1;
var sunDirection = new THREE.Vector3();
var cameraWithinAtmosphere = true;
var UniverseUp_Y_Vec = new THREE.Vector3(0,1,0);
//var UniverseToCam_Z_Vec = new THREE.Vector3(0,0,1);
var centerOfEarthToCameraVec = new THREE.Vector3();
var cameraDistFromCenterOfEarth = 0.0;
var amountToMoveCamera = 0.0;
var canUpdateCameraAtmosphereOrientation = true;
var canUpdateCameraSpaceOrientation = true;
var waterLevel = 0.0;
var cameraUnderWater = false;
var camPosToggle = false;
var timePauseToggle = false;


function toggleCameraPos() {

        camPosToggle = !camPosToggle;
        
        if (camPosToggle) {
                // camera on planet surface
                cameraControlsObject.position.set(-100, 0, earthRadius + 2.0); // in Km
                sunAngle = 0.5;
                canUpdateCameraAtmosphereOrientation = true;
                document.getElementById("cameraPosButton").innerHTML = "Teleport to Space";
        }	
        else {
                // camera in space
                cameraControlsObject.position.set(0, 0, earthRadius + 5000.0); // in Km
                sunAngle = 0.0;
                canUpdateCameraSpaceOrientation = true;
                document.getElementById("cameraPosButton").innerHTML = "Teleport to Surface";
        }

}

function toggleTimePause() {

        timePauseToggle = !timePauseToggle;

        if (timePauseToggle) {
                document.getElementById("timePauseButton").innerHTML = "Resume Time";
        }	
        else {
                document.getElementById("timePauseButton").innerHTML = "Pause Time";
        }

}

// called automatically from within initTHREEjs() function
function initSceneData() {
        
        // scene/demo-specific three.js objects setup goes here

        // set camera's field of view
        worldCamera.fov = 60;

        // position and orient camera
        // camera starts in space
        cameraControlsObject.position.set(0, 0, earthRadius + 5000.0); // in Km
        cameraControlsYawObject.rotation.y = 0.0;
        cameraControlsPitchObject.rotation.x = 0.0;
        
        PerlinNoiseTexture = new THREE.TextureLoader().load( 'textures/perlin256.png' );
        PerlinNoiseTexture.wrapS = THREE.RepeatWrapping;
        PerlinNoiseTexture.wrapT = THREE.RepeatWrapping;
        PerlinNoiseTexture.flipY = false;
        PerlinNoiseTexture.minFilter = THREE.LinearFilter;
        PerlinNoiseTexture.magFilter = THREE.LinearFilter;
        PerlinNoiseTexture.generateMipmaps = false;

} // end function initSceneData()



// called automatically from within initTHREEjs() function
function initPathTracingShaders() {
 
        // scene/demo-specific uniforms go here
        pathTracingUniforms = {
					
                tPreviousTexture: { type: "t", value: screenTextureRenderTarget.texture },		
                t_PerlinNoise: { type: "t", value: PerlinNoiseTexture },
                
                uCameraIsMoving: { type: "b1", value: false },
                uCameraJustStartedMoving: { type: "b1", value: false },
                uCameraWithinAtmosphere: { type: "b1", value: cameraWithinAtmosphere },
                
                uTime: { type: "f", value: 0.0 },
                uSampleCounter: { type: "f", value: 0.0 },
                uFrameCounter: { type: "f", value: 1.0 },
                uULen: { type: "f", value: 1.0 },
                uVLen: { type: "f", value: 1.0 },
                uApertureSize: { type: "f", value: 0.0 },
                uFocusDistance: { type: "f", value: 1180.0 },
                uCameraUnderWater: { type: "f", value: 0.0 },
                uSunAngle: { type: "f", value: 0.0 },
                
                uResolution: { type: "v2", value: new THREE.Vector2() },
                
                uRandomVector: { type: "v3", value: new THREE.Vector3() },
                uSunDirection: { type: "v3", value: new THREE.Vector3() },
                uCameraFrameRight: { type: "v3", value: new THREE.Vector3() },
                uCameraFrameForward: { type: "v3", value: new THREE.Vector3() },
                uCameraFrameUp: { type: "v3", value: new THREE.Vector3() },
                
                uCameraMatrix: { type: "m4", value: new THREE.Matrix4() }

        };

        pathTracingDefines = {
        	//NUMBER_OF_TRIANGLES: total_number_of_triangles
        };

        // load vertex and fragment shader files that are used in the pathTracing material, mesh and scene
        fileLoader.load('shaders/common_PathTracing_Vertex.glsl', function (shaderText) {
                pathTracingVertexShader = shaderText;

                createPathTracingMaterial();
        });

} // end function initPathTracingShaders()


// called automatically from within initPathTracingShaders() function above
function createPathTracingMaterial() {

        fileLoader.load('shaders/Planet_Rendering_Fragment.glsl', function (shaderText) {
                
                pathTracingFragmentShader = shaderText;

                pathTracingMaterial = new THREE.ShaderMaterial({
                        uniforms: pathTracingUniforms,
                        defines: pathTracingDefines,
                        vertexShader: pathTracingVertexShader,
                        fragmentShader: pathTracingFragmentShader,
                        depthTest: false,
                        depthWrite: false
                });

                pathTracingMesh = new THREE.Mesh(pathTracingGeometry, pathTracingMaterial);
                pathTracingScene.add(pathTracingMesh);

                // the following keeps the large scene ShaderMaterial quad right in front 
                //   of the camera at all times. This is necessary because without it, the scene 
                //   quad will fall out of view and get clipped when the camera rotates past 180 degrees.
                worldCamera.add(pathTracingMesh);
                
        });

} // end function createPathTracingMaterial()



// called automatically from within the animate() function
function updateVariablesAndUniforms() {
        
        // scene/demo-specific variables

        // reset vectors that may have changed
        cameraControlsObject.updateMatrixWorld(true);
        controls.getDirection(cameraDirectionVector);
        cameraDirectionVector.normalize();

        centerOfEarthToCameraVec.copy(cameraControlsObject.position);
        cameraDistFromCenterOfEarth = centerOfEarthToCameraVec.length();
        centerOfEarthToCameraVec.normalize();

        altitude = Math.max(0.001, cameraDistFromCenterOfEarth - earthRadius);
        camFlightSpeed = Math.max(0.1, altitude * 0.3);
        camFlightSpeed = Math.min(camFlightSpeed, 500.0);

        // camera within atmosphere
        if (cameraDistFromCenterOfEarth < atmosphereRadius)
        {
                cameraWithinAtmosphere = true;
                canUpdateCameraSpaceOrientation = true;
                oldRotationY = cameraControlsYawObject.rotation.y;
                //oldRotationX = cameraControlsPitchObject.rotation.x;

                if (canUpdateCameraAtmosphereOrientation)
                {
                        cameraControlsObject.quaternion.setFromUnitVectors(UniverseUp_Y_Vec, centerOfEarthToCameraVec);
                        cameraControlsObject.updateMatrixWorld(true);
                        
                        cameraControlsObject.up.copy(centerOfEarthToCameraVec);
                        cameraControlsObject.rotateOnWorldAxis(cameraControlsObject.up, cameraControlsObject.rotation.y + oldRotationY);
                        cameraControlsPitchObject.rotation.x = 0;
                        cameraControlsObject.updateMatrixWorld(true);

                        pathTracingUniforms.uCameraFrameRight.value.set(
                                cameraControlsObject.matrixWorld.elements[0],
                                cameraControlsObject.matrixWorld.elements[1],
                                cameraControlsObject.matrixWorld.elements[2] );

                        pathTracingUniforms.uCameraFrameUp.value.set(
                                cameraControlsObject.matrixWorld.elements[4],
                                cameraControlsObject.matrixWorld.elements[5],
                                cameraControlsObject.matrixWorld.elements[6] );

                        pathTracingUniforms.uCameraFrameForward.value.set(
                                cameraControlsObject.matrixWorld.elements[8],
                                cameraControlsObject.matrixWorld.elements[9],
                                cameraControlsObject.matrixWorld.elements[10] );

                }

                canUpdateCameraAtmosphereOrientation = false;
        }
        else { // camera in space
                cameraWithinAtmosphere = false;
                canUpdateCameraAtmosphereOrientation = true;
                oldRotationY = cameraControlsYawObject.rotation.y;

                if (canUpdateCameraSpaceOrientation)
                {
                        //cameraControlsObject.quaternion.setFromUnitVectors(centerOfEarthToCameraVec, UniverseToCam_Z_Vec);
                        cameraControlsObject.rotation.set(0,0,0);
                        cameraControlsObject.up.set(0, 1, 0);
                        cameraControlsObject.updateMatrixWorld(true);
                
                        //cameraControlsObject.rotateOnWorldAxis(cameraControlsObject.up, cameraControlsObject.rotation.y + oldRotationY);
                        cameraControlsPitchObject.rotation.x = 0;
                        cameraControlsObject.updateMatrixWorld(true);

                        pathTracingUniforms.uCameraFrameRight.value.set(1, 0, 0);
                        pathTracingUniforms.uCameraFrameUp.value.set(0, 1, 0);
                        pathTracingUniforms.uCameraFrameForward.value.set(0, -1, 0);
                }
                canUpdateCameraSpaceOrientation = false;
                
        }

        if (cameraDistFromCenterOfEarth < (earthRadius + 0.001))
        {
                amountToMoveCamera = (earthRadius + 0.001) - cameraDistFromCenterOfEarth;
                cameraControlsObject.position.add(centerOfEarthToCameraVec.multiplyScalar(amountToMoveCamera));
        }
        
        if ( cameraIsMoving ) {
					
                sampleCounter = 1.0;
                frameCounter  += 1.0;
                
                if ( !cameraRecentlyMoving ) {
                        cameraJustStartedMoving = true;
                        cameraRecentlyMoving = true;
                }
                
        }
        
        if ( !cameraIsMoving ) {

                sampleCounter = 1.0; // for continuous updating of image
                //sampleCounter += 1.0; // for progressive refinement of image
                frameCounter  += 1.0;
                if (cameraRecentlyMoving)
                        frameCounter = 1.0;

                cameraRecentlyMoving = false;
                
        }

        if (altitude < 1.0) // in Km
                cameraUnderWater = 1.0;
        else cameraUnderWater = 0.0;
        
        if (!timePauseToggle)
                sunAngle += (0.05 * frameTime) % TWO_PI;
        sunDirection.set(Math.cos(sunAngle), 0, Math.sin(sunAngle));
        sunDirection.normalize();

        pathTracingUniforms.uCameraUnderWater.value = cameraUnderWater;
        pathTracingUniforms.uSunAngle.value = sunAngle;
        pathTracingUniforms.uSunDirection.value.copy(sunDirection);
        pathTracingUniforms.uTime.value = elapsedTime;
        pathTracingUniforms.uCameraIsMoving.value = cameraIsMoving;
        pathTracingUniforms.uCameraJustStartedMoving.value = cameraJustStartedMoving;
        pathTracingUniforms.uCameraWithinAtmosphere.value = cameraWithinAtmosphere;
        pathTracingUniforms.uSampleCounter.value = sampleCounter;
        pathTracingUniforms.uFrameCounter.value = frameCounter;
        pathTracingUniforms.uRandomVector.value.copy(randomVector.set( Math.random(), Math.random(), Math.random() ));

        // CAMERA
        cameraControlsObject.updateMatrixWorld(true);			
        pathTracingUniforms.uCameraMatrix.value.copy( worldCamera.matrixWorld );
        screenOutputMaterial.uniforms.uOneOverSampleCounter.value = 1.0 / sampleCounter;
                        // 1.0 Km
        if (altitude >= 1.0) { 
                cameraInfoElement.innerHTML = "Altitude: " + altitude.toFixed(1) + " Kilometers | " + (altitude * 0.621371).toFixed(1) + " Miles" +
                " (Water Level = 1 Km)" + "<br>" +
                "FOV: " + worldCamera.fov + " / Aperture: " + apertureSize.toFixed(2) + " / FocusDistance: " + focusDistance + "<br>" +
                "Samples: " + sampleCounter;
        }
        else {
                cameraInfoElement.innerHTML = "Altitude: " + Math.floor(1000 * altitude) + " meters | " + Math.floor(1000 * altitude * 3.28084) + " feet" + "<br>" +
                "FOV: " + worldCamera.fov + " / Aperture: " + apertureSize.toFixed(2) + " / FocusDistance: " + focusDistance + "<br>" +
                "Samples: " + sampleCounter;
        }

} // end function updateUniforms()



initWindowAndControls(); // boilerplate: init handlers for window, mouse / mobile controls

initTHREEjs(); // boilerplate: init necessary three.js items and scene/demo-specific objects

onWindowResize(); // this 'jumpstarts' the initial dimensions and parameters for the window and renderer

// everything is set up, now we can start animating
animate();