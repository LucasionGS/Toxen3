# Toxen storyboards
A storyboard is writte non YAML format. It is a list of objects, each object is a dictionary with data about the event to play.
## Example
```yaml
storyboard:
  - start: 0 # The time when the event should start
    end: 2:30 # This could also just be set to 150
    component: visualizerColor # The component/event type to use
    data: # The data to pass to the component. The required data is different for each component
      color: [255, 255, 255] # The color to use as RGB. Colors can also be specified as hex strings, e.g. "#FFFFFF"
```

Data can have a couple different types. The following types are supported:
- `Number` - A number  
Example: `1`, `2.5`, `0.5`

- `String` - A string  
Example: `"Hello world"`, `"1"`

- `Boolean` - A boolean  
Example: `true`, `false`

- `Color` - A color. Can be specified as an array of 3-4 numbers (RGB or RGBA) or a hex string (e.g. "#FFFFFF")  
Example: `[255, 255, 255]`, `"#FFFFFF"`

- `VisualizerStyle` - A visualizer style.  
These are specific values:
  - `none`
  - `progressbar`
  - `bottom`
  - `top`
  - `topbottom`
  - `sides`
  - `center`
  - `circle`
  - `circlelogo`
  - `mirroredsingularity`
  - `mirroredsingularitywithlogo`

