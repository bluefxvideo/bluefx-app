'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { UserPlus, Loader2, CheckCircle, AlertCircle, RefreshCw, Copy } from 'lucide-react'
import { createUserWithAdminAPI } from '@/actions/auth'

// Password generation utility
function generateSecurePassword(length = 12): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const numbers = '0123456789'
  const symbols = '!@#$%^&*'
  
  const allChars = lowercase + uppercase + numbers + symbols
  
  let password = ''
  // Ensure at least one character from each category
  password += lowercase[Math.floor(Math.random() * lowercase.length)]
  password += uppercase[Math.floor(Math.random() * uppercase.length)]
  password += numbers[Math.floor(Math.random() * numbers.length)]
  password += symbols[Math.floor(Math.random() * symbols.length)]
  
  // Fill the rest randomly
  for (let i = 4; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)]
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('')
}

interface AdminUserCreateFormProps {
  onSuccess?: () => void
  onCancel?: () => void
}

export function AdminUserCreateForm({ onSuccess, onCancel }: AdminUserCreateFormProps) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [passwordCopied, setPasswordCopied] = useState(false)
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    full_name: '',
    payment_type: 'clickbank' as 'fastspring' | 'clickbank',
    credits: 600
  })

  // Generate a new secure password
  const generatePassword = () => {
    const newPassword = generateSecurePassword()
    setFormData(prev => ({ ...prev, password: newPassword }))
    setPasswordCopied(false)
  }

  // Copy password to clipboard
  const copyPassword = async () => {
    if (formData.password) {
      try {
        await navigator.clipboard.writeText(formData.password)
        setPasswordCopied(true)
        setTimeout(() => setPasswordCopied(false), 2000)
      } catch (err) {
        console.error('Failed to copy password:', err)
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      // Create user via Admin API
      const result = await createUserWithAdminAPI({
        email: formData.email,
        password: formData.password,
        email_confirm: true,
        user_metadata: {
          email_verified: true,
          phone_verified: false,
          full_name: formData.full_name
        },
        app_metadata: {
          provider: 'email',
          providers: ['email'],
          plan_type: 'pro'
        }
      })

      if (result.error) {
        setMessage({ type: 'error', text: result.error })
        return
      }

      // Create profile, subscription, and credits via server action
      const profileResult = await fetch('/api/admin/create-user-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: result.data.id,
          email: formData.email,
          username: formData.username,
          full_name: formData.full_name,
          plan_type: 'pro',
          payment_type: formData.payment_type,
          credits: formData.credits
        })
      })

      const profileData = await profileResult.json()

      if (!profileResult.ok) {
        // More detailed error message from the API
        const errorMessage = profileData.error || 'User created but profile setup failed'
        setMessage({ type: 'error', text: errorMessage })
        console.error('Profile setup error:', profileData)
        return
      }

      // Show success with credits info if available
      const successMessage = profileData.data?.credits 
        ? `User ${formData.email} created successfully with ${profileData.data.credits} credits!`
        : `User ${formData.email} created successfully!`
      
      setMessage({ type: 'success', text: successMessage })
      console.log('User creation complete:', profileData.data)
      
      // Reset form
      setFormData({
        email: '',
        password: '',
        username: '',
        full_name: '',
        payment_type: 'clickbank',
        credits: 600
      })

      // Call success callback after 2 seconds
      setTimeout(() => {
        onSuccess?.()
      }, 2000)

    } catch (error) {
      console.error('User creation error:', error)
      setMessage({ type: 'error', text: 'An unexpected error occurred' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Create New User
        </CardTitle>
        <CardDescription>
          Create a new user account with proper authentication setup
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Account Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Account Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="user@example.com"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Temporary Password *</Label>
                <div className="flex gap-2">
                  <Input
                    id="password"
                    type="text"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Temporary password"
                    minLength={8}
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={generatePassword}
                    title="Generate secure password"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={copyPassword}
                    disabled={!formData.password}
                    title="Copy password to clipboard"
                    className={passwordCopied ? 'bg-green-50 border-green-200' : ''}
                  >
                    <Copy className={`h-4 w-4 ${passwordCopied ? 'text-green-600' : ''}`} />
                  </Button>
                </div>
                {passwordCopied && (
                  <p className="text-xs text-green-600">Password copied to clipboard!</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Click generate button to create a secure password automatically
                </p>
              </div>
            </div>
          </div>

          {/* Profile Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Profile Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="username"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                  placeholder="John Doe"
                />
              </div>
            </div>
          </div>

          {/* Subscription Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Subscription Settings</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="payment_type">Payment Type</Label>
                <Select 
                  value={formData.payment_type} 
                  onValueChange={(value: 'fastspring' | 'clickbank') => 
                    setFormData(prev => ({ ...prev, payment_type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fastspring">FastSpring</SelectItem>
                    <SelectItem value="clickbank">ClickBank</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  All users created will have Pro plan with the selected payment provider
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="credits">Initial Credits</Label>
                <Input
                  id="credits"
                  type="number"
                  min="0"
                  value={formData.credits}
                  onChange={(e) => setFormData(prev => ({ ...prev, credits: parseInt(e.target.value) || 0 }))}
                  placeholder="600"
                />
              </div>
            </div>
          </div>

          {/* Messages */}
          {message && (
            <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
              {message.type === 'success' ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4">
            {onCancel && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={onCancel}
                disabled={loading}
              >
                Cancel
              </Button>
            )}
            <Button 
              type="submit" 
              disabled={loading}
              className=""
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating User...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create User
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}