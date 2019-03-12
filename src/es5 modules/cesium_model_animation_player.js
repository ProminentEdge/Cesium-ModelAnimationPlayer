define([
    'Cesium/Source/Cesium',
    'domReady'
], function(
    Cesium
) {

  var module = {};

  module.LOOP_TYPE = Object.freeze({"CLAMP":1, "LOOP":2});
  module.PLAY_STATE = Object.freeze({"PLAY":1, "STOP":2, "PAUSE":3});

  module.AnimationKey  = function(time, value) {
      this.time = time;
      this.value = value;
  }

  module.AnimationTrack = function() {
    this.translation_keys = [];
    this.rotation_keys = [];
    this.scale_keys = [];
  }

  module.Animation = function(name) {
    this.name = name;
    this.duration = 0;
    this.tracks = {}; // a dictionary whose keys are node names
  }

  module.AnimationSet = function(animations, nodes) {
    this.animations = animations;
    this.nodes = nodes;
  }

  module.AnimationPlayer = function(animation_set, entity, fps) {
    this.loop_type = module.LOOP_TYPE.CLAMP;
    this.play_state = module.PLAY_STATE.STOP;
    this.animation_set = animation_set;
    this.current_animation = this.animation_set.animations[0];
    this.entity = entity;

    // set initial node positions for Cesium entity
    var cesium_nodes = {};
    for(var node_name in this.animation_set.nodes) {
      cesium_nodes[node_name] = {
        translation: new Cesium.Cartesian3(0, 0, 0),
        rotation: new Cesium.Cartesian4(0, 0, 0, 1),
        scale: new Cesium.Cartesian3(1, 1, 1)
      }
    }

    this.entity.model.nodeTransformations = cesium_nodes;
    this.interval_id = -1;
    this.current_time = 0;
    this.speed = 1;
    this._frame_duration = 1.0/fps;


    this.setAnimation = function(animation_name) {
      for(var i = 0; i < this.animation_set.animations.length; i++) {
        if(animation_name === this.animation_set.animations[i].name) {
          this.current_animation = this.animation_set.animations[i];
          return;
        }
      }
      console.error("Can't set current animation: " + animation_name + " does not exist");
    };

    this.setFPS = function(fps) {
      this._frame_duration = 1.0/fps;
    };

    this.play = function(animation_name) {
      if(typeof animation_name === 'undefined') {
        if(this.play_state === module.PLAY_STATE.PLAY) {
          return;
        } else if(this.play_state === module.PLAY_STATE.PAUSE) {
          this.play_state = module.PLAY_STATE.PLAY;
        } else if(this.play_state === module.PLAY_STATE.STOP) {
          this.play_state = module.PLAY_STATE.PLAY;
          this.interval_id = window.setInterval(() => this._update(), this._frame_duration * 1000);
        }
        return;
      }

      var animations = this.animation_set.animations;
      for(var i = 0; i < animations.length; i++) {
        if(animations[i].name === animation_name) {
          this.current_animation = animations[i];
          if(this.play_state === module.PLAY_STATE.PLAY) {
            return;
          } else if(this.play_state === module.PLAY_STATE.PAUSE) {
            this.play_state = module.PLAY_STATE.PLAY;
          } else if(this.play_state === module.PLAY_STATE.STOP) {
            this.play_state = module.PLAY_STATE.PLAY;
            this.interval_id = window.setInterval(() => this._update(), this._frame_duration * 1000);
          }
          return;
        }
      }
      console.error("Can't play animation: " + animation_name + " does not exist");
    };

    this._update = function() {
      this.setTime(this.current_time + this._frame_duration * this.speed);
    }

    this.setPercent = function(percent) {
      if(percent < 0.0) {
        percent = 0.0;
      }
      else if(percent > 1.0) {
        percent = 1.0;
      }
      var time = this.current_animation.duration * percent;
      this.setTime(time);
    }

    this.setTime = function(current_time) {
      if(this.play_state === module.PLAY_STATE.PAUSE)
        return;

      this.current_time = current_time;
      if(this.speed > 0) {
        if(this.current_time > this.current_animation.duration) {
          if(this.loop_type === module.LOOP_TYPE.CLAMP) {
            this.current_time = this.current_animation.duration;
          } else if(this.loop_type === module.LOOP_TYPE.LOOP) {
            this.current_time = 0;
          }
        }
      } else if(this.speed < 0) {
        if(this.current_time < 0) {
          if(this.loop_type === module.LOOP_TYPE.CLAMP) {
            this.current_time = 0;
          } else if(this.loop_type === module.LOOP_TYPE.LOOP) {
            this.current_time = this.current_animation.duration;
          }
        }
      }


      for(var track_name in this.current_animation.tracks) {
        //if(track_name != "SA_ROT_0FBXASC04548")
        //  continue;
        var track = this.current_animation.tracks[track_name];
        var curr_trans_keys = this.getKeysAtTime(track.translation_keys, this.current_time);
        var curr_rot_keys = this.getKeysAtTime(track.rotation_keys, this.current_time);
        var curr_scale_keys = this.getKeysAtTime(track.scale_keys, this.current_time);

        //--------------------------
        // Translation
        //--------------------------
        if(curr_trans_keys.length > 0) {

          var orig_trans = this.animation_set.nodes[track_name].translation;
          if(curr_trans_keys[0].time == curr_trans_keys[1].time) {
            var result = Cesium.Cartesian3(curr_trans_keys[0].value[0] - orig_trans[0], curr_trans_keys[0].value[1] - orig_trans[1], curr_trans_keys[0].value[2] - orig_trans[2]);
            this.entity.model.nodeTransformations[track_name].translation = result;
          } else {
            var keyDelta = curr_trans_keys[1].time - curr_trans_keys[0].time;
            var timeDelta = this.current_time - curr_trans_keys[0].time;
            var t = timeDelta/keyDelta;
            var start = new Cesium.Cartesian3(curr_trans_keys[0].value[0] - orig_trans[0], curr_trans_keys[0].value[1] - orig_trans[1], curr_trans_keys[0].value[2] - orig_trans[2]);
            var end = new Cesium.Cartesian3(curr_trans_keys[1].value[0] - orig_trans[0], curr_trans_keys[1].value[1] - orig_trans[1], curr_trans_keys[1].value[2] - orig_trans[2]);
            var result = new Cesium.Cartesian3();
            Cesium.Cartesian3.lerp(start, end, t, result);
            this.entity.model.nodeTransformations[track_name].translation = result;
          }
        }

        //--------------------------
        // Rotation
        //--------------------------
        if(curr_rot_keys.length > 0) {

          //first store the original rotation and it's inverse so we can calculate the incremental rotations
          var orig_rot = this.animation_set.nodes[track_name].rotation;
          var orig = new Cesium.Quaternion(orig_rot[0], orig_rot[1], orig_rot[2], orig_rot[3]);
          var orig_inv = new Cesium.Quaternion(0,0,0,1);
          Cesium.Quaternion.inverse(orig, orig_inv);

          if(curr_rot_keys[0].time == curr_rot_keys[1].time) {
            var result = Cesium.Quaternion(curr_rot_keys[0].value[0], curr_rot_keys[0].value[1], curr_rot_keys[0].value[2], curr_rot_keys[0].value[3]);
            Cesium.Quaternion.multiply(result, orig_inv, result);
            this.entity.model.nodeTransformations[track_name].rotation = result;
          } else {
            var keyDelta = curr_rot_keys[1].time - curr_rot_keys[0].time;
            var timeDelta = this.current_time - curr_rot_keys[0].time;
            var t = timeDelta/keyDelta;
            var start = new Cesium.Quaternion(curr_rot_keys[0].value[0], curr_rot_keys[0].value[1], curr_rot_keys[0].value[2], curr_rot_keys[0].value[3]);
            var end = new Cesium.Quaternion(curr_rot_keys[1].value[0], curr_rot_keys[1].value[1], curr_rot_keys[1].value[2], curr_rot_keys[1].value[3]);

            Cesium.Quaternion.multiply(start, orig_inv, start);
            Cesium.Quaternion.multiply(end, orig_inv,  end);

            var result = new Cesium.Quaternion(0,0,0,1);
            Cesium.Quaternion.slerp(start, end, t, result);
            this.entity.model.nodeTransformations[track_name].rotation = result;
          }
        }

        //--------------------------
        // Scale
        //--------------------------
        if(curr_scale_keys.length > 0) {
          var orig_scale = this.animation_set.nodes[track_name].scale;

          if(curr_scale_keys[0].time == curr_scale_keys[1].time) {
            var result = Cesium.Cartesian3(curr_scale_keys[0].value[0] - orig_scale[0], curr_scale_keys[0].value[1] - orig_scale[1], curr_scale_keys[0].value[2] - orig_scale[2]);
            this.entity.model.nodeTransformations[track_name].scale = result;
          } else {
            var keyDelta = curr_scale_keys[1].time - curr_scale_keys[0].time;
            var timeDelta = this.current_time - curr_scale_keys[0].time;
            var t = timeDelta/keyDelta;
            var start = new Cesium.Cartesian3(curr_scale_keys[0].value[0] - orig_scale[0], curr_scale_keys[0].value[1] - orig_scale[1], curr_scale_keys[0].value[2] - orig_scale[2]);
            var end = new Cesium.Cartesian3(curr_scale_keys[1].value[0] - orig_scale[0], curr_scale_keys[1].value[1] - orig_scale[1], curr_scale_keys[1].value[2] - orig_scale[2]);
            var result = new Cesium.Cartesian3();
            Cesium.Cartesian3.lerp(start, end, t, result);
            this.entity.model.nodeTransformations[track_name].scale = result;
          }
        }
      }
    }

    this.getKeysAtTime = function(keys, time) {
      var result = [];
      if(keys.length == 0)
        return result;

      //we need to return some value even if the first key for this track isn't reached quite yet
      if(keys[0].time > time) {
        result.push(keys[0]);
        result.push(keys[0]);
        return result;
      }

      //just clamp the last key if we are at the end
      if(time > keys[keys.length-1].time) {
        result.push(keys[keys.length-1]);
        result.push(keys[keys.length-1]);
        return result;
      }

      for(var i = 0; i < keys.length-1; i++) {
        if(keys[i].time <= time && keys[i+1].time >= time) {
          result.push(keys[i]);
          result.push(keys[i+1]);
          return result;
        }
      }
    }

    this.stop = function() {
      this.play_state = module.PLAY_STATE.STOP;

      //reset the node transforms on the entity to the default pose
      var cesium_nodes = {};
      for(var node_name in this.animation_set.nodes) {
        cesium_nodes[node_name] = {
          translation: new Cesium.Cartesian3(0, 0, 0),
          rotation: new Cesium.Cartesian4(0, 0, 0, 1),
          scale: new Cesium.Cartesian3(1, 1, 1)
        }
      }
      this.entity.model.nodeTransformations = cesium_nodes;

      //clear the update interval
      clearInterval(this.interval_id);
      this.interval_id = -1;
    }

    this.pause = function() {
      //no need to pause if we are not playing
      if(this.play_state === module.PLAY_STATE.PLAY)
        this.play_state = module.PLAY_STATE.PAUSE;
    }
  }

  module.AnimationParser = function() {
    this._readFileAsync = function(file) {
      return new Promise((resolve, reject) => {
        var reader = new FileReader();

        reader.onload = () => {
          resolve(reader.result);
        };

        reader.onerror = reject;

        reader.readAsArrayBuffer(file);
      });
    }

    this._getResourceAsync = function(uri) {
      return new Promise((resolve, reject) => {
        var req = new Request(uri);

        fetch(req).then(function(response) {
          resolve(response.arrayBuffer());
        });
      });
    }

    this.parseAnimationNodesFromArrayBuffer = function(array_buffer) {
      // get the length of the JSON data starting at 12 byte offset according to gltf standard
      var dv = new DataView(array_buffer, 12, 4);
      // don't forget to set little-endian = true when parsing from data view (gltf standard!)
      var json_chunk_length = dv.getUint32(0, true);
      console.log("gltf JSON length: " + json_chunk_length + " bytes");

      // get the actual JSON data itself
      var json_data_chunk = array_buffer.slice(20, 20+json_chunk_length);
      var decoder = new TextDecoder('UTF-8');
      var json_text = decoder.decode(json_data_chunk);
      var gltf_json = JSON.parse(json_text);
      console.log("gltf JSON loaded successfully:");
      return gltf_json.nodes;
    }

    this.parseAnimationsFromArrayBuffer = function(array_buffer) {
      var animations = [];

      // get the length of the JSON data starting at 12 byte offset according to gltf standard
      var dv = new DataView(array_buffer, 12, 4);
      // don't forget to set little-endian = true when parsing from data view (gltf tandard!)
      var json_chunk_length = dv.getUint32(0, true);
      console.log("gltf JSON length: " + json_chunk_length + " bytes");

      // get the actual JSON data itself
      var json_data_chunk = array_buffer.slice(20, 20+json_chunk_length);
      var decoder = new TextDecoder('UTF-8');
      var json_text = decoder.decode(json_data_chunk);
      var gltf_json = JSON.parse(json_text);
      console.log("gltf JSON loaded successfully:");
      console.log(gltf_json);

      // get the length of the gltf embedded binary data
      var bin_offset = 20+json_chunk_length;
      dv = new DataView(array_buffer, bin_offset, 4);
      var bin_chunk_length = dv.getUint32(0, true);
      console.log("gltf bin length: " + bin_chunk_length + " bytes");

      // get the actual binary data, we add 8 to get past the "type" and "chunk length" headers
      var bin_data_chunk = array_buffer.slice(bin_offset + 8, bin_offset + 8 + bin_chunk_length);

      //--------------------------------------------------
      // get and process all animations
      //--------------------------------------------------
      for(var i = 0; i < gltf_json.animations.length; i++) {
        var anim_name = gltf_json.animations[i].name;
        if(typeof anim_name == 'undefined' || anim_name == "")
          anim_name = "animation_" + i;
        var curr_animation = new module.Animation(anim_name);
        console.log("processing animation: " + anim_name);

        for(var k = 0; k < gltf_json.animations[i].channels.length; k++) {
          var channel = gltf_json.animations[i].channels[k];

          // the following will be either "translation, rotation, or scale"
          var dof_type = channel.target.path;

          var node = gltf_json.nodes[channel.target.node];
          if(typeof node == 'undefined') {
            console.warn("node is undefined for channel " + k);
            continue;
          }

          var node_name = node.name;
          if(typeof node_name == 'undefined' || node.name == "") {
            node_name = "node_" + channel.target.node;
          }

          // add a new track to this animation for the node if it does not exist already
          if(typeof curr_animation.tracks[node_name] == 'undefined')
            curr_animation.tracks[node_name] = new module.AnimationTrack();

          var sampler = gltf_json.animations[i].samplers[channel.sampler];

          //--------------------------------------------------
          // get input accessor (keyframe times for this channel's sampler) and process the data for it
          //--------------------------------------------------
          var input = gltf_json.accessors[sampler.input];
          //console.log("min: " + input.min + " max: " + input.max);

          var input_accessor_byte_offset =  (typeof input.byteOffset == 'undefined' ? 0 : input.byteOffset);
          if(input.componentType != 5126)
            console.warn("input component type is not a float!");

          // each element (keyframe timestamp) is a 4 byte float
          var input_element_size = 4;

          //use the buffer view and accessor to offset into the binary buffer to retrieve our data
          var input_bufferView = gltf_json.bufferViews[input.bufferView];
          var input_accessor_data_offset = input_bufferView.byteOffset + input_accessor_byte_offset;
          var input_bin = bin_data_chunk.slice(input_accessor_data_offset, input_accessor_data_offset + input_element_size * input.count);
          var input_dv = new DataView(input_bin);

          // parse and store each timestamp out of the buffer
          var timestamps = [];
          for(var j = 0; j < input.count; j++) {
            var timestamp = input_dv.getFloat32(j*4, true);
            if(timestamp > curr_animation.duration) {
              curr_animation.duration = timestamp;
            }
            timestamps.push(timestamp);
          }

          //--------------------------------------------------
          // get output accessor (keyframe values for this channel's sampler) and process the data for it
          //--------------------------------------------------
          var output = gltf_json.accessors[sampler.output];

          var output_accessor_byte_offset =  (typeof output.byteOffset == 'undefined' ? 0 : output.byteOffset);

          // we only care about VEC3 and VEC4 since we are only dealing with rotation, scale, and translation,
          // and we are going to assume they are floating point (componentType = 5126 according to gltf spec)
          if(output.componentType != 5126)
            console.warn("output component type is not a float!");

          var output_component_count = (output.type == "VEC3" ? 3 : 4);
          // 4 byte floats in according to gltf spec
          var output_element_size = output_component_count * 4;

          //use the buffer view and accessor to offset into the binary buffer to retrieve our value data
          var output_bufferView = gltf_json.bufferViews[output.bufferView];
          var output_accessor_data_offset = output_bufferView.byteOffset + output_accessor_byte_offset;
          var output_bin = bin_data_chunk.slice(output_accessor_data_offset, output_accessor_data_offset + output_element_size * output.count);
          var output_dv = new DataView(output_bin);

          // parse and store each value
          var values = [];
          for(var j = 0; j < output.count * output_component_count; j += output_component_count) {
            var value = [];
            for(var l = 0; l < output_component_count; l++) {
              value.push(output_dv.getFloat32(j*4 + l*4, true));
            }
            values.push(value);
          }

          if(dof_type == "translation") {
            for(var j = 0; j < output.count; j++) {
              curr_animation.tracks[node_name].translation_keys.push(new module.AnimationKey(timestamps[j], values[j]));
            }
          } else if(dof_type == "rotation") {
            for(var j = 0; j < output.count; j++) {
              curr_animation.tracks[node_name].rotation_keys.push(new module.AnimationKey(timestamps[j], values[j]));
            }
          } else if(dof_type == "scale") {
            for(var j = 0; j < output.count; j++) {
              curr_animation.tracks[node_name].scale_keys.push(new module.AnimationKey(timestamps[j], values[j]));
            }
          }
        }
        animations.push(curr_animation);
      }
      return animations;
    }

    this.parseAnimationSetFromUri = async function(glb_uri) {
      var array_buffer = await this._getResourceAsync(glb_uri);

      var animation_nodes = this.parseAnimationNodesFromArrayBuffer(array_buffer);
      // convert nodes to dictionary format
      var nodes_dict = {};
      for(var i = 0; i < animation_nodes.length; i++) {
        nodes_dict[animation_nodes[i].name] = animation_nodes[i];
      }

      var animations = this.parseAnimationsFromArrayBuffer(array_buffer);
      console.log(nodes_dict);
      return new module.AnimationSet(animations, nodes_dict);
    }

    this.parseAnimationSetFromFile = async function(glb_file) {
      var array_buffer = await this._readFileAsync(glb_file);

      var animation_nodes = this.parseAnimationNodesFromArrayBuffer(array_buffer);
      // convert nodes to dictionary format
      var nodes_dict = {};
      for(var i = 0; i < animation_nodes.length; i++) {
        nodes_dict[animation_nodes[i].name] = animation_nodes[i];
      }

      var animations = this.parseAnimationsaFromArrayBuffer(array_buffer);
      console.log(nodes_dict);
      return new module.AnimationSet(animations, nodes_dict);
    }
  };

  return module;
}); // end require.js definition