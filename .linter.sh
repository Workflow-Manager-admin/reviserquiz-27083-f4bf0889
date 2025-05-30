#!/bin/bash
cd /home/kavia/workspace/code-generation/reviserquiz-27083-f4bf0889/reviser_quiz
npm run lint
LINT_EXIT_CODE=$?
if [ $LINT_EXIT_CODE -ne 0 ]; then
  exit 1
fi

