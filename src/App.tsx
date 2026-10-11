import NightSky from './components/NightSky'
import CitySkyline from './components/CitySkyline'
import FireworksCanvas from './components/FireworksCanvas'
import MuteButton from './components/MuteButton'

export default function App() {
  return (
    <div className="app">
      <NightSky />
      <FireworksCanvas />
      <CitySkyline />
      <MuteButton />
    </div>
  )
}
