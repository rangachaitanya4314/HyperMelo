package app.hypermelo.feature.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Security
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.hypermelo.core.designsystem.HyperMeloColors
import app.hypermelo.core.designsystem.HyperMeloGlassCard

@Composable
fun AuthScreen(
    modifier: Modifier = Modifier
) {
    val scrollState = rememberScrollState()

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(HyperMeloColors.Obsidian)
            .padding(20.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scrollState),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Icon(
                imageVector = Icons.Default.Security,
                contentDescription = "Identity Architecture",
                tint = HyperMeloColors.WarmPeach,
                modifier = Modifier.height(56.dp)
            )

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "HYPERMELO ACCOUNT",
                color = HyperMeloColors.TextPrimary,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 2.sp
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "Cross-Platform Identity Architecture",
                color = HyperMeloColors.WarmPeach,
                fontSize = 14.sp
            )

            Spacer(modifier = Modifier.height(24.dp))

            HyperMeloGlassCard(
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp)
                ) {
                    Text(
                        text = "Current State Analysis",
                        color = HyperMeloColors.TextPrimary,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 15.sp
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "The web application currently utilizes client-side PBKDF2-HMAC-SHA256 (100k rounds) stored exclusively inside the browser's localStorage. No remote auth endpoint currently exists.",
                        color = HyperMeloColors.TextSecondary,
                        fontSize = 13.sp,
                        lineHeight = 18.sp
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    Text(
                        text = "Required Shared Backend Contract",
                        color = HyperMeloColors.WarmPeach,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 14.sp
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "• POST /api/v1/auth/register\n• POST /api/v1/auth/login\n• GET /api/v1/auth/me (JWT bearer token)\n• Cross-platform playlist & history sync",
                        color = HyperMeloColors.TextSecondary,
                        fontSize = 12.sp,
                        lineHeight = 18.sp
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            Button(
                onClick = { /* Pending backend contract */ },
                colors = ButtonDefaults.buttonColors(
                    containerColor = HyperMeloColors.WarmPeach,
                    contentColor = HyperMeloColors.Obsidian
                ),
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Default.Lock, contentDescription = null)
                Spacer(modifier = Modifier.padding(horizontal = 4.dp))
                Text("Backend Auth Endpoint Required", fontWeight = FontWeight.Bold)
            }
        }
    }
}

