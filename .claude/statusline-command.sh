#!/bin/bash
# CleanMateX Status Line - Model and Context Usage Only

input=$(cat)

# Extract model name
model=$(echo "$input" | jq -r '.model.display_name')

# Extract context usage percentage
used=$(echo "$input" | jq -r '.context_window.used_percentage // empty')

# Output format: Model Name | Context: X.X% used
if [ -n "$used" ]; then
  printf "%s | Context: %.1f%% used" "$model" "$used"
else
  echo "$model"
fi
