import { lazy, Suspense } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { Button, Result, Spin } from 'antd';
import AppLayout from './components/AppLayout';
import AuthModal from './components/AuthModal';
import Home from './pages/Home';

// The 3D game and its engine load only when someone opens it.
const PlayRooftop = lazy(() => import('./pages/PlayRooftop'));
const PlayHeist = lazy(() => import('./pages/PlayHeist'));
const PlayWingsuit = lazy(() => import('./pages/PlayWingsuit'));
const PlayHideSeek = lazy(() => import('./pages/PlayHideSeek'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const Profile = lazy(() => import('./pages/Profile'));

const Loading = () => (
  <div className="center-screen">
    <Spin size="large" />
  </div>
);

export default function App() {
  return (
    <>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/play/rooftop-runner" element={<PlayRooftop />} />
          <Route path="/play/night-heist" element={<PlayHeist />} />
          <Route path="/play/wingsuit-canyon" element={<PlayWingsuit />} />
          <Route path="/play/museum-hide-seek" element={<PlayHideSeek />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/profile" element={<Profile />} />
            <Route
              path="*"
              element={<Result status="404" title="Page not found" extra={<Link to="/"><Button type="primary">Back to games</Button></Link>} />}
            />
          </Route>
        </Routes>
      </Suspense>
      <AuthModal />
    </>
  );
}
