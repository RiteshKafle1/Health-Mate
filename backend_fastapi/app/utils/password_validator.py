"""
Password Validation and Strength Scoring Utility

This module provides comprehensive password validation including:
- Strength scoring (0-100)
- Character requirement checks (uppercase, lowercase, numeric, special)
- Common password detection
- Password breach checking via HaveIBeenPwned API
- Real-time feedback for UI display
"""

import re
import hashlib
import httpx
from typing import Dict, List, Tuple
from enum import Enum


class PasswordStrength(str, Enum):
    """Password strength levels."""
    WEAK = "Weak"
    FAIR = "Fair"
    GOOD = "Good"
    STRONG = "Strong"


class PasswordValidator:
    """Comprehensive password validation and strength scoring."""
    
    # Common passwords to reject (top 100 most common)
    COMMON_PASSWORDS = {
        "password", "123456", "12345678", "1234", "qwerty", "12345", "dragon",
        "pussy", "baseball", "football", "letmein", "monkey", "696969", "abc123",
        "mustang", "michael", "shadow", "master", "jennifer", "111111", "2000",
        "jordan", "superman", "harley", "1234567", "fuckme", "hunter", "fuckyou",
        "trustno1", "ranger", "buster", "thomas", "tigger", "robert", "soccer",
        "fuck", "batman", "test", "pass", "killer", "hockey", "george", "charlie",
        "andrew", "michelle", "love", "sunshine", "jessica", "asshole", "6969",
        "pepper", "daniel", "access", "123456789", "654321", "joshua", "maggie",
        "starwars", "silver", "william", "dallas", "yankees", "123123", "ashley",
        "666666", "hello", "amanda", "orange", "biteme", "freedom", "computer",
        "sexy", "thunder", "nicole", "ginger", "heather", "hammer", "summer",
        "corvette", "taylor", "fucker", "austin", "1111", "merlin", "matthew",
        "121212", "golfer", "cheese", "princess", "martin", "chelsea", "patrick",
        "richard", "diamond", "yellow", "bigdog", "secret", "asdfgh", "sparky",
        "cowboy", "camaro", "anthony", "matrix"
    }
    
    # Special characters allowed
    SPECIAL_CHARS = r"!@#$%^&*()_+\-=\[\]{}|;:,.<>?"
    
    @classmethod
    def validate_password(cls, password: str, check_breach: bool = True) -> Dict:
        """
        Comprehensive password validation with strength scoring.
        
        Args:
            password: The password to validate
            check_breach: Whether to check against breached passwords (default: True)
            
        Returns:
            Dictionary containing validation results:
            {
                "valid": bool,
                "score": int (0-100),
                "strength": str (Weak/Fair/Good/Strong),
                "feedback": {
                    "hasMinLength": bool,
                    "hasUppercase": bool,
                    "hasLowercase": bool,
                    "hasNumeric": bool,
                    "hasSpecial": bool,
                    "isNotCommon": bool,
                    "isNotBreached": bool,
                    "noSequential": bool
                },
                "suggestions": [str],
                "message": str
            }
        """
        feedback = {
            "hasMinLength": len(password) >= 8,
            "hasUppercase": bool(re.search(r'[A-Z]', password)),
            "hasLowercase": bool(re.search(r'[a-z]', password)),
            "hasNumeric": bool(re.search(r'\d', password)),
            "hasSpecial": bool(re.search(f'[{re.escape(cls.SPECIAL_CHARS)}]', password)),
            "isNotCommon": password.lower() not in cls.COMMON_PASSWORDS,
            "isNotBreached": True,  # Will be updated if check_breach is True
            "noSequential": not cls._has_sequential_chars(password)
        }
        
        # Check for breached passwords
        if check_breach:
            feedback["isNotBreached"] = not cls._check_breach(password)
        
        # Calculate score
        score = cls._calculate_score(password, feedback)
        
        # Determine strength level
        strength = cls._get_strength_level(score)
        
        # Generate suggestions
        suggestions = cls._generate_suggestions(feedback)
        
        # Check if password meets minimum requirements
        valid = all([
            feedback["hasMinLength"],
            feedback["hasUppercase"],
            feedback["hasLowercase"],
            feedback["hasNumeric"],
            feedback["hasSpecial"],
            feedback["isNotCommon"],
            feedback["isNotBreached"]
        ])
        
        # Generate message
        if valid:
            message = f"Password strength: {strength}"
        else:
            message = "Password does not meet security requirements"
        
        return {
            "valid": valid,
            "score": score,
            "strength": strength,
            "feedback": feedback,
            "suggestions": suggestions,
            "message": message
        }
    
    @classmethod
    def _calculate_score(cls, password: str, feedback: Dict) -> int:
        """Calculate password strength score (0-100)."""
        score = 0
        
        # Length scoring (0-30 points)
        length = len(password)
        if length >= 8:
            score += 10
        if length >= 12:
            score += 10
        if length >= 16:
            score += 10
        
        # Character variety (0-40 points)
        if feedback["hasUppercase"]:
            score += 10
        if feedback["hasLowercase"]:
            score += 10
        if feedback["hasNumeric"]:
            score += 10
        if feedback["hasSpecial"]:
            score += 10
        
        # Additional security checks (0-30 points)
        if feedback["isNotCommon"]:
            score += 10
        if feedback["isNotBreached"]:
            score += 10
        if feedback["noSequential"]:
            score += 10
        
        # Entropy bonus (0-10 points)
        unique_chars = len(set(password))
        if unique_chars >= length * 0.7:  # 70% unique characters
            score += 5
        if unique_chars >= length * 0.9:  # 90% unique characters
            score += 5
        
        return min(score, 100)
    
    @classmethod
    def _get_strength_level(cls, score: int) -> str:
        """Determine strength level from score."""
        if score <= 40:
            return PasswordStrength.WEAK
        elif score <= 60:
            return PasswordStrength.FAIR
        elif score <= 80:
            return PasswordStrength.GOOD
        else:
            return PasswordStrength.STRONG
    
    @classmethod
    def _has_sequential_chars(cls, password: str) -> bool:
        """Check for sequential characters (abc, 123, etc.)."""
        # Check for sequential letters
        for i in range(len(password) - 2):
            if password[i:i+3].isalpha():
                chars = password[i:i+3].lower()
                if (ord(chars[1]) == ord(chars[0]) + 1 and 
                    ord(chars[2]) == ord(chars[1]) + 1):
                    return True
        
        # Check for sequential numbers
        for i in range(len(password) - 2):
            if password[i:i+3].isdigit():
                if (int(password[i+1]) == int(password[i]) + 1 and 
                    int(password[i+2]) == int(password[i+1]) + 1):
                    return True
        
        return False
    
    @classmethod
    def _check_breach(cls, password: str) -> bool:
        """
        Check if password has been breached using HaveIBeenPwned API.
        Uses k-Anonymity model - only sends first 5 chars of SHA-1 hash.
        
        Returns:
            True if password found in breach database, False otherwise
        """
        try:
            # Generate SHA-1 hash of password
            sha1_hash = hashlib.sha1(password.encode('utf-8')).hexdigest().upper()
            prefix = sha1_hash[:5]
            suffix = sha1_hash[5:]
            
            # Query API with first 5 characters
            url = f"https://api.pwnedpasswords.com/range/{prefix}"
            response = httpx.get(url, timeout=3.0)
            
            if response.status_code == 200:
                # Check if our suffix appears in the response
                hashes = response.text.split('\n')
                for hash_line in hashes:
                    if ':' in hash_line:
                        hash_suffix, count = hash_line.split(':')
                        if hash_suffix == suffix:
                            return True  # Password found in breach
            
            return False  # Password not found
        except Exception as e:
            # If API fails, don't block password creation
            print(f"Breach check failed: {e}")
            return False
    
    @classmethod
    def _generate_suggestions(cls, feedback: Dict) -> List[str]:
        """Generate user-friendly suggestions for improving password."""
        suggestions = []
        
        if not feedback["hasMinLength"]:
            suggestions.append("Use at least 8 characters")
        if not feedback["hasUppercase"]:
            suggestions.append("Add at least one uppercase letter (A-Z)")
        if not feedback["hasLowercase"]:
            suggestions.append("Add at least one lowercase letter (a-z)")
        if not feedback["hasNumeric"]:
            suggestions.append("Add at least one number (0-9)")
        if not feedback["hasSpecial"]:
            suggestions.append("Add at least one special character (!@#$%^&*)")
        if not feedback["isNotCommon"]:
            suggestions.append("Avoid common passwords")
        if not feedback["isNotBreached"]:
            suggestions.append("This password has been found in data breaches - choose a different one")
        if not feedback["noSequential"]:
            suggestions.append("Avoid sequential characters (abc, 123)")
        
        return suggestions


def validate_password_strength(password: str, check_breach: bool = True) -> Dict:
    """
    Convenience function for password validation.
    
    Args:
        password: Password to validate
        check_breach: Whether to check against breached passwords
        
    Returns:
        Validation result dictionary
    """
    return PasswordValidator.validate_password(password, check_breach)
