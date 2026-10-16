import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Avatar, Button, Dropdown } from 'antd';
import { AppstoreOutlined, LogoutOutlined, TrophyOutlined, UserOutlined } from '@ant-design/icons';
import { useAuth } from '../auth/AuthContext';
import { AVATARS } from '../games/catalog';

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Playverse home">
      <img src="/favicon.svg" alt="" width={32} height={32} />
      <span>Playverse</span>
    </Link>
  );
}

export default function AppLayout() {
  const { user, status, signOut, askToSignIn } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="shell">
      <header className="topnav">
        <Logo />
        <nav className="navlinks" aria-label="Main">
          <NavLink to="/" end><AppstoreOutlined /> <span>Games</span></NavLink>
          <NavLink to="/leaderboard"><TrophyOutlined /> <span>Leaderboards</span></NavLink>
          {user && <NavLink to="/profile"><UserOutlined /> <span>Profile</span></NavLink>}
        </nav>
        <div className="nav-right">
          {user ? (
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  { key: 'p', icon: <UserOutlined />, label: 'Profile', onClick: () => navigate('/profile') },
                  { key: 'o', icon: <LogoutOutlined />, label: 'Sign out', danger: true, onClick: signOut },
                ],
              }}
            >
              <Button type="text" className="user-btn" aria-label="Account menu">
                <Avatar className="emoji-avatar">{AVATARS[user.avatar] ?? '🙂'}</Avatar>
                <span className="user-name">{user.username}</span>
              </Button>
            </Dropdown>
          ) : status === 'checking' ? null : (
            <Button type="primary" onClick={() => askToSignIn()}>Log in</Button>
          )}
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
      <footer className="footer">Playverse · built by Kavya Immanni · React, TypeScript, Babylon.js, Node.js, MongoDB</footer>
    </div>
  );
}
