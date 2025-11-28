import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Arena from "./pages/Arena";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Arena/>}></Route>
      </Routes>
    </Router>


  );
}

export default App;
