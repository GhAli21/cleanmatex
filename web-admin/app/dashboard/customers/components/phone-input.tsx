/**
 * PRD-003: Phone Input Component
 * Phone input with country code selector
 */

import { useState } from 'react'

interface PhoneInputProps {
  value: string
  onChange: (value: string) => void
  label?: string
  required?: boolean
  error?: string
  disabled?: boolean
  placeholder?: string
  id?: string
  name?: string
}

interface CountryCode {
  code: string
  label: string
  flag: string
}

const COUNTRY_CODES: CountryCode[] = [
  { code: '+968', label: 'Oman', flag: '🇴🇲' },
  { code: '+971', label: 'UAE', flag: '🇦🇪' },
  { code: '+966', label: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '+965', label: 'Kuwait', flag: '🇰🇼' },
  { code: '+973', label: 'Bahrain', flag: '🇧🇭' },
  { code: '+974', label: 'Qatar', flag: '🇶🇦' },
  { code: '+20', label: 'Egypt', flag: '🇪🇬' },
  { code: '+962', label: 'Jordan', flag: '🇯🇴' },
  { code: '+961', label: 'Lebanon', flag: '🇱🇧' },
]

export default function PhoneInput({
  value,
  onChange,
  label = 'Phone Number',
  required = false,
  error,
  disabled = false,
  placeholder = '90123456',
  id,
  name,
}: PhoneInputProps) {
  const [countryCode, setCountryCode] = useState('+968')
  const [localNumber, setLocalNumber] = useState('')
  const phoneId = id || 'phone'
  const phoneName = name || 'phone'

  // Parse value on mount or when it changes externally
  useState(() => {
    if (value) {
      const matched = COUNTRY_CODES.find((c) => value.startsWith(c.code))
      if (matched) {
        setCountryCode(matched.code)
        setLocalNumber(value.slice(matched.code.length))
      } else {
        setLocalNumber(value)
      }
    }
  })

  const handleCountryCodeChange = (newCode: string) => {
    setCountryCode(newCode)
    onChange(newCode + localNumber)
  }

  const handleLocalNumberChange = (newNumber: string) => {
    // Remove non-digits
    const cleaned = newNumber.replace(/\D/g, '')
    setLocalNumber(cleaned)
    onChange(countryCode + cleaned)
  }

  const formatPhoneNumber = (num: string) => {
    // Format as: 90 123 456 or 9012 3456
    if (num.length <= 2) return num
    if (num.length <= 5) return `${num.slice(0, 2)} ${num.slice(2)}`
    if (num.length <= 8) return `${num.slice(0, 2)} ${num.slice(2, 5)} ${num.slice(5)}`
    return `${num.slice(0, 4)} ${num.slice(4)}`
  }

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <div className="flex">
        {/* Country Code Selector */}
        <select
          id={`${phoneId}_country`}
          name={`${phoneName}_country`}
          value={countryCode}
          onChange={(e) => handleCountryCodeChange(e.target.value)}
          disabled={disabled}
          className="w-32 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {COUNTRY_CODES.map((country) => (
            <option key={country.code} value={country.code}>
              {country.flag} {country.code}
            </option>
          ))}
        </select>

        {/* Phone Number Input */}
        <input
          type="tel"
          id={phoneId}
          name={phoneName}
          value={localNumber}
          onChange={(e) => handleLocalNumberChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={`flex-1 block w-full rounded-r-md border ${
            error ? 'border-red-300' : 'border-gray-300'
          } px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 ${
            error
              ? 'focus:ring-red-500 focus:border-red-500'
              : 'focus:ring-blue-500 focus:border-blue-500'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          maxLength={10}
        />
      </div>

      {/* Helper Text / Error */}
      {error ? (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      ) : (
        <p className="mt-1 text-xs text-gray-500">
          {localNumber ? (
            <>
              <span className="font-medium">Full number:</span> {countryCode}
              {formatPhoneNumber(localNumber)}
            </>
          ) : (
            'Enter phone number without country code'
          )}
        </p>
      )}
    </div>
  )
}
