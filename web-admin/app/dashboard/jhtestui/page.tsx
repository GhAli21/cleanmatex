'use client';

import { useState } from 'react';
import JwtViewerJhTest from './components/JwtViewerJhTest';
import UserContextViewer from './components/UserContextViewer';
import AuthContextViewer from './components/AuthContextViewer';
import { Key, Bug, Database, Zap, TestTube2 } from 'lucide-react';

/**
 *
 */
export default function JhTestUiPage() {
  const [activeTest, setActiveTest] = useState<string>('jwt');

  const testButtons = [
    {
      id: 'jwt',
      label: 'JWT Viewer',
      icon: Key,
      description: 'Decode and inspect Supabase JWT token',
      color: 'blue',
    },
    {
      id: 'usercontext',
      label: 'User & Tenant Context',
      icon: Database,
      description: 'View authenticated user and tenant information',
      color: 'green',
    },
    {
      id: 'authcontext',
      label: 'Auth Context (useAuth)',
      icon: Zap,
      description: 'View auth context state from useAuth hook',
      color: 'purple',
    },
    {
      id: 'test4',
      label: 'Test 4',
      icon: TestTube2,
      description: 'Placeholder for future test',
      color: 'orange',
    },
  ];

  const getButtonColorClasses = (color: string, isActive: boolean) => {
    const colors = {
      blue: isActive
        ? 'bg-primary text-primary-foreground border-primary'
        : 'bg-card text-primary-text border-info-border hover:bg-info-bg',
      green: isActive
        ? 'bg-success text-on-solid border-success'
        : 'bg-card text-success-text border-success-border hover:bg-success-bg',
      purple: isActive
        ? 'bg-primary text-primary-foreground border-primary'
        : 'bg-card text-primary-text border-info-border hover:bg-info-bg',
      orange: isActive
        ? 'bg-warning text-warning-foreground border-warning'
        : 'bg-card text-warning-text border-warning-border hover:bg-warning-bg',
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  return (
    <div className="min-h-screen bg-muted p-6">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Bug className="h-8 w-8 text-primary-text" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Test & Debug Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Development tools for testing and debugging various components
            </p>
          </div>
        </div>

        {/* Test Buttons */}
        <div className="bg-card rounded-lg border border-border p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground mb-3">Select Test Module</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {testButtons.map((button) => {
              const Icon = button.icon;
              const isActive = activeTest === button.id;

              return (
                <button
                  key={button.id}
                  onClick={() => setActiveTest(button.id)}
                  className={`
                    flex flex-col items-start p-4 rounded-lg border-2 transition-all
                    ${getButtonColorClasses(button.color, isActive)}
                    ${isActive ? 'shadow-md scale-105' : 'shadow-sm'}
                  `}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-5 w-5" />
                    <span className="font-semibold">{button.label}</span>
                  </div>
                  <p className={`text-xs ${isActive ? 'text-on-solid/90' : 'text-muted-foreground'}`}>
                    {button.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="transition-all duration-300">
        {activeTest === 'jwt' && <JwtViewerJhTest />}

        {activeTest === 'usercontext' && <UserContextViewer />}

        {activeTest === 'authcontext' && <AuthContextViewer />}

        {activeTest === 'test4' && (
          <div className="bg-card rounded-lg border border-border p-8 text-center">
            <TestTube2 className="h-12 w-12 text-warning-text mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">Test 4 Component</h3>
            <p className="text-muted-foreground">This test module is not yet implemented.</p>
            <p className="text-sm text-muted-foreground mt-2">Add your test component here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
