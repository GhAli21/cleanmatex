'use client';

import { useState } from 'react';
import JwtViewerJhTest from '@/components/jhtest/JwtViewerJhTest';
import UserContextViewer from '@/components/jhtest/UserContextViewer';
import AuthContextViewer from '@/components/jhtest/AuthContextViewer';
import { Key, Bug, Database, Zap, TestTube2 } from 'lucide-react';

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
        ? 'bg-blue-600 text-white border-blue-600'
        : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50',
      green: isActive
        ? 'bg-green-600 text-white border-green-600'
        : 'bg-white text-green-600 border-green-200 hover:bg-green-50',
      purple: isActive
        ? 'bg-purple-600 text-white border-purple-600'
        : 'bg-white text-purple-600 border-purple-200 hover:bg-purple-50',
      orange: isActive
        ? 'bg-orange-600 text-white border-orange-600'
        : 'bg-white text-orange-600 border-orange-200 hover:bg-orange-50',
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Bug className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Test & Debug Dashboard</h1>
            <p className="text-sm text-gray-600 mt-1">
              Development tools for testing and debugging various components
            </p>
          </div>
        </div>

        {/* Test Buttons */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Select Test Module</h2>
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
                  <p className={`text-xs ${isActive ? 'text-white/90' : 'text-gray-600'}`}>
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
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <TestTube2 className="h-12 w-12 text-orange-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Test 4 Component</h3>
            <p className="text-gray-600">This test module is not yet implemented.</p>
            <p className="text-sm text-gray-500 mt-2">Add your test component here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
