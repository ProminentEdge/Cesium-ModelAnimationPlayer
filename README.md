# Cesium-ModelAnimationPlayer
An animation player for use with Cesium entities to play glTF animations independent of the standard timeline.

## Installation
Currently the simplest way to install the code is to copy the `cesium_model_animation_player.js` file and incorporate it into your project's source directory

## Examples
### Basic usage
First load the animation set from the glTF file. Currently only .glb format with embedded asset data is supported.
```
let animation_set = await AnimationParser.parseAnimationSetFromFile('../assets/my_model.glb');
```
Next instantiate the AnimationPlayer, passing it the animation set and the Cesium entity to animate, along with desired playback FPS. Default playback is set to "clamp", but looping is supported as illustrated below.
```
let player = new AnimationPlayer(animation_set, entity, 30);
player.loop_type = LOOP_TYPE.LOOP;
player.play("animation_name");
```
You can set the playback speed (multiplier) as well, negative values will cause the animation to play in reverse.
```
player.speed = 2.0;
```

### Manual control
Instead of calling `play()`, you can update the player manually as well. The argument is the current time in seconds you want to set the animation to. Make sure the player is stopped first!
```
player.stop();
player.setAnimation("current_animation_name");
player.setTime(current_time);
```
You can also update the player by setting the animation based on a percentage of its duration.
```
player.setPercent(0.5);
```

### Debugging tips
You can access information about the animations and the nodes from the animation player directly.
```
// check current animation duration
player.current_animation.duration

// print names of animations associated with this player
for(var i = 0; i < player.animations.length; i++) {
  console.log(player.animations[i].name);
}

// get keyframe information for the current animation (or any animation)
for(track in player.current_animation.tracks) {
    console.log(track.translation_keys);
    console.log(track.rotation_keys);
    console.log(track.scale_keys);
}
```

## Notes and TODOs
* Models and animations must conform to glTF 2.0 spec
* In order for exported models/animations to be compatible with the player all nodes must be named.
* As mentioned previously, currently only the .glb format is compatible with this system with the animation data embedded in the binary. If there is an urgent need for supporting standard glTF format please create an issue and let us know.
* While the glTF format allows for byte, short, int, and float component types for rotations (`Vec4`), the parser currently assumes floats only.
* Currently the `play()` method operates on the main thread via `setInterval`. In the future this should be re-worked to make use of web workers.
* If you find yourself needing web workers for true concurrency of animation playback, remember that you can still accomplish this by making use of either the `setTime` or `setPercent` methods