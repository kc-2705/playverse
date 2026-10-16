import { useState } from 'react';
import { Alert, Button, Form, Input, Modal, Segmented } from 'antd';
import { LockOutlined, MailOutlined, UserOutlined } from '@ant-design/icons';
import { useAuth } from '../auth/AuthContext';
import { errorMessage } from '../api/client';

/** One dialog for logging in and creating an account, opened from anywhere. */
export default function AuthModal() {
  const { authPrompt, closeAuthPrompt, login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(values: Record<string, string>) {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') await login(values.login, values.password);
      else await register({ username: values.username, email: values.email, password: values.password });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={authPrompt.open}
      onCancel={() => {
        setError(null);
        closeAuthPrompt();
      }}
      footer={null}
      destroyOnHidden
      width={420}
      title={mode === 'login' ? 'Welcome back' : 'Create your player account'}
    >
      {authPrompt.reason && <p className="muted" style={{ marginTop: 0 }}>{authPrompt.reason}.</p>}
      <Segmented
        block
        value={mode}
        onChange={(v) => {
          setMode(v as 'login' | 'register');
          setError(null);
        }}
        options={[
          { label: 'Log in', value: 'login' },
          { label: 'Sign up', value: 'register' },
        ]}
        style={{ marginBottom: 18 }}
      />
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 14 }} />}
      <Form layout="vertical" requiredMark={false} onFinish={submit} key={mode}>
        {mode === 'login' ? (
          <Form.Item name="login" label="Username or email" rules={[{ required: true, message: 'Enter your username or email.' }]}>
            <Input prefix={<UserOutlined />} autoComplete="username" autoFocus />
          </Form.Item>
        ) : (
          <>
            <Form.Item
              name="username"
              label="Username"
              extra="Shown on leaderboards. 3–20 letters, numbers or underscores."
              rules={[{ required: true, pattern: /^[A-Za-z0-9_]{3,20}$/, message: 'Use 3–20 letters, numbers or underscores.' }]}
            >
              <Input prefix={<UserOutlined />} autoComplete="username" autoFocus />
            </Form.Item>
            <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Enter a valid email.' }]}>
              <Input prefix={<MailOutlined />} autoComplete="email" />
            </Form.Item>
          </>
        )}
        <Form.Item
          name="password"
          label="Password"
          rules={[{ required: true, min: mode === 'register' ? 8 : 1, message: mode === 'register' ? 'Use at least 8 characters.' : 'Enter your password.' }]}
        >
          <Input.Password prefix={<LockOutlined />} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        </Form.Item>
        <Button type="primary" htmlType="submit" block size="large" loading={busy}>
          {mode === 'login' ? 'Log in' : 'Create account'}
        </Button>
      </Form>
    </Modal>
  );
}
