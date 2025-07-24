# Security Policy

## Supported Versions

We actively maintain security for the following versions of KitchAI:

| Version | Supported          |
| ------- | ------------------ |
| 2.x     | :white_check_mark: |
| 1.x     | :x:                |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability in KitchAI, please report it responsibly.

### How to Report

**🔒 For security issues, please DO NOT open a public GitHub issue.**

Instead, please report security vulnerabilities through one of the following methods:

1. **GitHub Security Advisories** (Preferred)
   - Go to our repository's Security tab
   - Click "Report a vulnerability"
   - Fill out the private advisory form

2. **Email** (Alternative)
   - Send details to: security@kitchai.app
   - Include "SECURITY" in the subject line
   - Provide detailed description and steps to reproduce

### What to Include

Please provide as much information as possible:

- Type of vulnerability (e.g., XSS, SQL injection, authentication bypass)
- Affected component(s)
- Steps to reproduce the issue
- Potential impact
- Any suggested fixes (if known)

### Response Timeline

- **Initial Response**: Within 48 hours
- **Assessment**: Within 1 week
- **Fix Timeline**: Critical issues within 2 weeks, others within 30 days
- **Disclosure**: After fix is deployed and users have had time to update

### Responsible Disclosure

We follow responsible disclosure practices:

1. We'll acknowledge receipt of your report
2. We'll investigate and validate the issue
3. We'll develop and test a fix
4. We'll deploy the fix to production
5. We'll publicly acknowledge your contribution (with your permission)

### Security Measures

KitchAI implements multiple security layers:

- **Authentication**: Supabase Auth with JWT tokens
- **Authorization**: Row Level Security (RLS) policies
- **Data Protection**: Encrypted data transmission (HTTPS/WSS)
- **Input Validation**: Comprehensive sanitization and validation
- **Environment Isolation**: Separate development/production environments
- **Dependency Management**: Regular security updates and vulnerability scanning

### Out of Scope

The following are typically outside our security scope:

- Social engineering attacks
- Physical access to user devices
- Vulnerabilities in third-party services (Supabase, OpenAI, etc.)
- Issues affecting unsupported versions

### Recognition

We appreciate security researchers who help keep KitchAI safe. Contributors will be acknowledged in our security hall of fame (with permission).

---

## Contact

For non-security related issues, please use our standard GitHub issues.

**Security Contact**: security@kitchai.app  
**General Contact**: support@kitchai.app

---

*Last updated: January 2025* 