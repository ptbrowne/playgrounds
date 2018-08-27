import React from 'react'
import ReactDOM from 'react-dom'
import { List, WindowScroller, AutoSizer } from 'react-virtualized'
import _pokemons from './pokemons.js'
import uniqBy from 'lodash/uniqBy'
import throttle from 'lodash/throttle'

const styles = {
  Main: {
    WebkitUserSelect: 'none',
    outline: 0,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"'
  },
  WindowScrollerWrapper: {
    flex: '1 1 auto'
  },
  Scrubber: {
    position: 'fixed',
    right: '0',
    zIndex: 1,
    top: 0,
    bottom: 0,
    height: 'auto',
    margin: 'auto',
    background: 'white',
    paddingRight: '1rem',
    paddingLeft: '1rem',
    textAlign: 'right',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    touchAction: 'none',
    cursor: 'move'
  },
  ScrubberElements: {
    position: 'relative',
    height: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    flexDirection: 'column'
  },
  LightPokeAvatar: {
    display: 'inline-block',
    background: '#eee',
    borderRadius: '5px'
  },
  PokeAvatar: {
    width: 32,
    height: 32,
    marginRight: '1rem'
  },
  Row: {
    borderBottom: '1px solid #eee',
    height: 50,
    display: 'flex',
    alignItems: 'center'
  }
}

const pokemons = uniqBy(_pokemons, x => x.number)

const getBoundaries = (list, getBoundary) => {
  let curBoundary
  const boundaries = []
  for (let i = 0; i < list.length; i++) {
    const row = list[i]
    const boundary = getBoundary(row)
    if (boundary !== curBoundary) {
      curBoundary = boundary
      boundaries.push([i, boundary])
    }
  }
  return boundaries
}

class WithDimensions extends React.Component {
  constructor () {
    super()
    this.state = {}
    this.update = this.update.bind(this)
  }
  componentDidMount () {
    console.log('node', this.node)
    window.addEventListener('resize', this.update)
    this.update()
  }
  componentWillUnmount() {
    window.removeEventListener('resize', this.update)
  }
  update() {
    this.setState({
      dimensions: this.node.getBoundingClientRect()
    })
  }
  render () {
    const { children, style } = this.props
    const { dimensions } = this.state
    return (
      <div style={style} ref={node => this.node = node}>
        {dimensions ? children(dimensions) : null }
      </div>
    )
  }
}

class Scrubber extends React.Component {
  constructor() {
    super()
    this.handleMouseMove = this.handleMouseMove.bind(this)
    this.handleMouseDown = this.handleMouseDown.bind(this)
    this.handleMouseUp = this.handleMouseUp.bind(this)
    this.handleTouchMove = throttle(this.handleTouchMove.bind(this), 100, { leading: true, trailing: true })
    document.addEventListener('mousedown', this.handleMouseDown)
    document.addEventListener('mouseup', this.handleMouseUp)
  }

  handleMouseDown (ev) {
    if (ev.which === 1) { this.clicking = true }
  }

  handleMouseUp (ev) {
    if (ev.which === 1) { this.clicking = false }
  }

  handleMouseMove(ev, i) {
    ev.preventDefault()
    if (this.clicking) {
      this.props.onScrub(i)
    }
  }

  handleTouchMove (ev, height) {
    ev.preventDefault()
    if (!ev.touches) {
      return
    }
    const y = ev.touches[0].pageY - window.scrollY
    const perc = y / height
    const list = this.props.list
    this.props.onScrub(Math.round(perc * list.length))
    this.setState({ i: Math.round(perc * list.length) })
  }

  render () {
    const list = this.props.list
    const top = `translateY(${this.props.scrollTop / (styles.Row.height * list.length) * 100}vh)`
    return (
      <WithDimensions style={styles.Scrubber}>{
        dimensions => {
          const scrubLineHeight = 20
          const elements = list.length
          const nbElements = Math.round(dimensions.height / scrubLineHeight) - 1
          const steps = Math.round(elements / nbElements)
          const numbers = getBoundaries(list, row => Math.round(parseInt(row.number) / steps))
          return <div onTouchMove={ev => { ev.persist(); this.handleTouchMove(ev, dimensions.height)}}>
            <div style={{ position: 'absolute', zIndex: 0, width: '100%', transition: 'transform 0.125s ease', transform: top, height: 20, background: '#eee' }}></div>
            <div style={styles.ScrubberElements}>{
              numbers.map(([i, number]) => {
                const pokemon = pokemons[i]
                return (
                  <div
                    onMouseMove={(ev) => this.handleMouseMove(ev, i)}
                    style={styles.ScrubItem}
                    onClick={() => this.props.onScrub(i)}
                  >
                    {parseInt(pokemon.number)}. { pokemon.name }
                  </div>
                )
              })
            }</div>
          </div>
        }
      }</WithDimensions>
    )
  }
}

const PokeAvatar = ({ src }) => {
  return  <img style={styles.PokeAvatar} width={'32'} height={'32'} src={src} />
}

const LightPokeAvatar = (src) => {
  return  <span style={Object.assign({}, styles.PokeAvatar, styles.LightPokeAvatar)} />
}

class App extends React.PureComponent {
  constructor () {
    super()
    this._setRef = this._setRef.bind(this)
    this._rowRenderer = this._rowRenderer.bind(this)
    this._scrollTo = this._scrollTo.bind(this)
    this.state = {
      scrollToIndex: 0
    }
    this.hasSeen = {}
  }

  _setRef (windowScroller) {
    this._windowScroller = windowScroller;
  }


  _rowRenderer ({index, isScrolling, isVisible, key, style}) {
    const list = this.props.list
    const row = list[index];
    const className = ''

    if (!isScrolling) {
      this.hasSeen[index] = true
    }
    return (
      <div key={key} className={className} style={Object.assign({}, style, styles.Row)}>
        {isScrolling && !this.hasSeen[index] ? <LightPokeAvatar /> : <PokeAvatar src={row.ThumbnailImage} />}
        {parseInt(row.number)}. {row.name}
      </div>
    );
  }

  _scrollTo (index) {
    setTimeout(() => {
      this.setState({
        scrollToIndex: index
      })
    }, 100)
  }

  render () {
    const { list } = this.props
    const { scrollToIndex } = this.state
    return (<div style={styles.Main}>
      <WindowScroller
        ref={this._setRef}
        scrollElement={window}>
        {({height, isScrolling, registerChild, onChildScroll, scrollTop}) => (
          <div>
            <Scrubber list={list} onScrub={this._scrollTo} scrollTop={scrollTop} height={height}/>
            <AutoSizer disableHeight>
              {({width}) => (
                <div ref={registerChild}>
                  <List
                    ref={el => {
                      window.listEl = el;
                    }}
                    autoHeight
                    style={{ outline: 'none'}}
                    className={styles.List}
                    height={height}
                    isScrolling={isScrolling}
                    onScroll={onChildScroll}
                    overscanRowCount={2}
                    rowCount={list.length}
                    rowHeight={styles.Row.height}
                    rowRenderer={this._rowRenderer}
                    scrollToIndex={scrollToIndex}
                    scrollToAlignment='start'
                    scrollTop={scrollTop}
                    width={width}
                  />
                </div>
              )}
            </AutoSizer>
          </div>
        )}
      </WindowScroller>
    </div>)
  }
}

ReactDOM.render(<App list={pokemons} />, document.querySelector('#app'))
