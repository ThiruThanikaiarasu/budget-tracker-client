import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

const registerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type RegisterFormData = z.infer<typeof registerSchema>;

function Register() {
  const navigate = useNavigate();
  const { register: registerUser, isAuthenticated, isLoading } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/transactions', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const onSubmit = async (data: RegisterFormData) => {
    try {
      await registerUser(data.email, data.password, data.name);
      navigate('/transactions');
    } catch {
      // Error toast is handled in the store
    }
  };

  return (
    <div className="auth-page flex min-h-screen items-center justify-center">
      <div className="auth-card w-full max-w-md">
        <p className="auth-kicker">Budget Tracker</p>
        <h1 className="auth-title">start your journey</h1>
        <p className="auth-subtitle">Create an account to take control of your money.</p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <div>
            <label htmlFor="name" className="auth-label block">
              Name
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              {...register('name')}
              className="auth-input"
              placeholder="Your name"
            />
            {errors.name && (
              <p className="auth-error">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="auth-label block">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              {...register('email')}
              className="auth-input"
              placeholder="you@example.com"
            />
            {errors.email && (
              <p className="auth-error">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="auth-label block">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register('password')}
              className="auth-input"
              placeholder="At least 6 characters"
            />
            {errors.password && (
              <p className="auth-error">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="auth-submit"
          >
            {isLoading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account?{' '}
          <Link to="/login">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
