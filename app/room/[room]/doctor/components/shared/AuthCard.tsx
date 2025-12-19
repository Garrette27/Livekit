'use client';

import React from 'react';
import Link from 'next/link';

interface AuthCardProps {
  icon: string;
  title: string;
  description: string;
  error?: string | null;
  children: React.ReactNode;
  footerLink?: { href: string; text: string };
}

export default function AuthCard({ icon, title, description, error, children, footerLink }: AuthCardProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem'
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '1rem',
          padding: '3rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          maxWidth: '28rem',
          width: '100%',
          textAlign: 'center'
        }}
      >
        <div
          style={{
            width: '4rem',
            height: '4rem',
            backgroundColor: '#dbeafe',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 2rem'
          }}
        >
          <span style={{ fontSize: '2rem' }}>{icon}</span>
        </div>

        <h1
          style={{
            fontSize: '1.875rem',
            fontWeight: 'bold',
            color: '#1e40af',
            marginBottom: '1rem'
          }}
        >
          {title}
        </h1>

        <p
          style={{
            fontSize: '1.125rem',
            color: '#6b7280',
            marginBottom: '2rem',
            lineHeight: '1.6'
          }}
        >
          {description}
        </p>

        {error && (
          <div
            style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '0.5rem',
              padding: '1rem',
              marginBottom: '1.5rem',
              color: '#dc2626'
            }}
          >
            {error}
          </div>
        )}

        {children}

        {footerLink && (
          <Link
            href={footerLink.href}
            style={{
              display: 'inline-block',
              color: '#6b7280',
              textDecoration: 'none',
              fontSize: '0.875rem',
              marginTop: '1rem'
            }}
          >
            {footerLink.text}
          </Link>
        )}
      </div>
    </div>
  );
}

