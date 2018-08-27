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
    cursor: 'pointer'
  },
  ScrubItem: {
    height: 20,
    fontSize: '0.75rem'
  },
  ScrubItems: {
    position: 'relative',
    height: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    flexDirection: 'column'
  },
  ScrubBar: {
    position: 'absolute',
    cursor: 'move',
    zIndex: 0,
    width: '100%',
    // transition: 'transform 0.125s ease',
    height: 50,
    background: '#eee'
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
    window.addEventListener('resize', this.update)
    this.update()
    setTimeout(() => {
      this.update()
    }, 1000)
  }
  componentWillUnmount() {
    window.removeEventListener('resize', this.update)
  }
  update() {
    const { height } = this.node.getBoundingClientRect()
    this.setState({
      dimensions: {
        bodyHeight: document.body.offsetHeight,
        height: height
      }
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

class ScrubBar extends React.PureComponent {
  constructor () {
    super()
    this.state = {}
    this.handleMouseMove = this.handleMouseMove.bind(this)
  }

  componentDidMount () {
    document.addEventListener('mousemove', this.handleMouseMove)
  }

  componentWillUnmount () {
    document.removeEventListener('mousemove', this.handleMouseMove)
  }

  handleMouseMove (ev) {
    if (!this.props.clicking) {
      return
    }
    const { height, list } = this.props
    const y = (ev.touches ? ev.touches[0].pageY : ev.pageY) - window.scrollY
    const perc = y / height
    this.props.onScrub(perc)
  }

  render () {
    const { perc, height } = this.props
    const ty = `translateY(${perc * height}px)`
    return (
      <div
        style={Object.assign({
           transform: ty
        }, styles.ScrubBar)} />
    )
  }
}

class Scrubber extends React.Component {
  constructor() {
    super()
    this.handleMouseDown = this.handleMouseDown.bind(this)
    this.handleMouseUp = this.handleMouseUp.bind(this)
    this.onScrub = throttle(this.onScrub.bind(this), 16)
    this.state = { clicking: false }
  }

  componentDidMount() {
    document.addEventListener('mouseup', this.handleMouseUp)
  }

  componentWillUnmount() {
    document.removeEventListener('mouseup', this.handleMouseUp)
  }

  handleMouseDown (ev) {
    this.setState({ clicking: true })
  }

  handleMouseUp (ev) {
    this.setState({ clicking: false })
  }

  onScrub (perc) {
    this.props.onScrub(perc)
  }

  render () {
    const { clicking } = this.state
    const { list, scrollTop } = this.props
    return (
      <WithDimensions style={styles.Scrubber}>{
        dimensions => {
          const scrubLineHeight = styles.ScrubItem.height
          const elements = list.length
          const nbElements = Math.round(dimensions.height / scrubLineHeight) - 1
          const steps = Math.round(elements / nbElements)
          const numbers = getBoundaries(list, row => Math.round(parseInt(row.number) / steps))
          const perc = scrollTop / dimensions.bodyHeight
          return <div>
            <ScrubBar perc={perc} clicking={clicking} onScrub={this.onScrub} list={list} height={dimensions.height} />
            <div onMouseDown={this.handleMouseDown} style={styles.ScrubItems}>{
              numbers.map(([i, number]) => {
                const pokemon = pokemons[i]
                return (
                  <div
                    key={i}
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

  _scrollTo (percentage) {
    const { list } = this.props
    const index = Math.round(percentage * list.length)
    this.setState({
      scrollToIndex: index
    })
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
            <Scrubber list={list} scrollTop={scrollTop} onScrub={this._scrollTo}/>
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
